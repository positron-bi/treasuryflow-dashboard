from __future__ import annotations

import os
from pathlib import Path
import queue
import sys
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import webbrowser

from treasuryflow_core import (
    APP_VERSION,
    TreasuryFlowError,
    application_home,
    classify_path,
    find_sources,
    has_changed,
    has_upload_request,
    import_files,
    load_state,
    process_sources,
    log_message,
    mark_upload_request,
)


def run_once_in_background() -> int:
    home = application_home()
    try:
        if has_changed(home):
            process_sources(home, force=False)
        return 0
    except Exception as error:
        log_message(home, f"بررسی پس‌زمینه ناموفق بود: {error}")
        return 1


class TreasuryFlowApp(tk.Tk):
    POLL_MS = 1000

    def __init__(self) -> None:
        super().__init__()
        self.home_dir = application_home()
        self.events: queue.Queue[tuple[str, object]] = queue.Queue()
        self.worker_running = False
        self.processor_enabled = os.environ.get("TREASURYFLOW_ROLE", "uploader").strip().lower() == "processor"
        self.auto_enabled = tk.BooleanVar(value=self.processor_enabled)
        self.status_text = tk.StringVar(value="در حال بررسی پوشه…")
        self.last_run_text = tk.StringVar(value="هنوز گزارشی ساخته نشده است")
        self.daily_text = tk.StringVar(value="—")
        self.manual_text = tk.StringVar(value="—")
        self.facilities_text = tk.StringVar(value="—")
        self.selected_files: dict[str, Path] = {}
        self.selected_daily_text = tk.StringVar(value="فایلی انتخاب نشده")
        self.selected_manual_text = tk.StringVar(value="فایلی انتخاب نشده")
        self.selected_facilities_text = tk.StringVar(value="فایلی انتخاب نشده")

        self.title(f"TreasuryFlow — گزارش جریان نقد | {APP_VERSION}")
        self.geometry("880x660")
        self.minsize(760, 590)
        self.configure(background="#f4f7fb")
        self.protocol("WM_DELETE_WINDOW", self.destroy)
        self._build_style()
        self._build_ui()
        self._refresh_sources()
        self.after(150, self._drain_events)
        self.after(800, self._auto_check)

    def _build_style(self) -> None:
        style = ttk.Style(self)
        try:
            style.theme_use("vista")
        except tk.TclError:
            pass
        style.configure("Title.TLabel", background="#f4f7fb", foreground="#123252", font=("Segoe UI", 20, "bold"))
        style.configure("Sub.TLabel", background="#f4f7fb", foreground="#5d7083", font=("Segoe UI", 10))
        style.configure("Card.TFrame", background="#ffffff", relief="solid", borderwidth=1)
        style.configure("CardTitle.TLabel", background="#ffffff", foreground="#526579", font=("Segoe UI", 9))
        style.configure("CardValue.TLabel", background="#ffffff", foreground="#152b42", font=("Segoe UI", 10, "bold"))
        style.configure("Status.TLabel", background="#eaf7ef", foreground="#17663a", font=("Segoe UI", 11, "bold"), padding=10)
        style.configure("Primary.TButton", font=("Segoe UI", 10, "bold"), padding=(16, 10))
        style.configure("Secondary.TButton", font=("Segoe UI", 10), padding=(12, 9))
        style.configure("TCheckbutton", background="#f4f7fb", font=("Segoe UI", 10))

    def _build_ui(self) -> None:
        shell = ttk.Frame(self, padding=(28, 22, 28, 20))
        shell.pack(fill="both", expand=True)

        ttk.Label(shell, text="TreasuryFlow", style="Title.TLabel", anchor="e").pack(fill="x")
        ttk.Label(
            shell,
            text="هر فایل را از بخش مربوط به خودش انتخاب کنید، سپس دکمه بارگذاری را بزنید.",
            style="Sub.TLabel",
            anchor="e",
            wraplength=800,
            justify="right",
        ).pack(fill="x", pady=(3, 16))

        ttk.Label(shell, textvariable=self.status_text, style="Status.TLabel", anchor="e").pack(fill="x", pady=(0, 14))

        cards = ttk.Frame(shell)
        cards.pack(fill="x")
        for column in range(3):
            cards.columnconfigure(column, weight=1, uniform="source")
        self._source_card(cards, 0, "گزارش روزانه خزانه", "daily", self.daily_text, self.selected_daily_text)
        self._source_card(cards, 1, "ورودی‌های دستی", "manual", self.manual_text, self.selected_manual_text)
        self._source_card(cards, 2, "گزارش تسهیلات", "facilities", self.facilities_text, self.selected_facilities_text)

        upload = ttk.Frame(shell)
        upload.pack(fill="x", pady=(18, 5))
        tk.Button(
            upload,
            text="بارگذاری فایل‌های انتخاب‌شده",
            command=self._upload_selected,
            background="#16a34a",
            activebackground="#15803d",
            foreground="#ffffff",
            activeforeground="#ffffff",
            font=("Segoe UI", 11, "bold"),
            relief="flat",
            padx=42,
            pady=10,
            cursor="hand2",
        ).pack(anchor="center")

        if self.processor_enabled:
            actions = ttk.Frame(shell)
            actions.pack(fill="x", pady=(8, 8))
            ttk.Button(actions, text="به‌روزرسانی گزارش", style="Secondary.TButton", command=lambda: self._start_process(True)).pack(side="right", padx=8)
            ttk.Button(actions, text="باز کردن داشبورد", style="Secondary.TButton", command=self._open_dashboard).pack(side="right", padx=8)
            ttk.Button(actions, text="باز کردن پوشه", style="Secondary.TButton", command=self._open_folder).pack(side="right", padx=8)

            options = ttk.Frame(shell)
            options.pack(fill="x", pady=(5, 10))
            ttk.Checkbutton(
                options,
                text="تشخیص فوری فایل جدید روی سیستم اصلی",
                variable=self.auto_enabled,
            ).pack(side="right")
            ttk.Label(options, textvariable=self.last_run_text, style="Sub.TLabel").pack(side="left")

        log_card = ttk.Frame(shell, style="Card.TFrame", padding=10)
        log_card.pack(fill="both", expand=True, pady=(4, 0))
        ttk.Label(log_card, text="رویدادهای برنامه", style="CardValue.TLabel", anchor="e").pack(fill="x", pady=(0, 6))
        self.log_box = tk.Text(
            log_card,
            height=12,
            wrap="word",
            background="#f9fbfd",
            foreground="#26394d",
            relief="flat",
            font=("Segoe UI", 9),
            padx=10,
            pady=8,
        )
        self.log_box.pack(fill="both", expand=True)
        self.log_box.configure(state="disabled")

    def _source_card(
        self,
        parent: ttk.Frame,
        column: int,
        title: str,
        kind: str,
        current: tk.StringVar,
        selected: tk.StringVar,
    ) -> None:
        card = ttk.Frame(parent, style="Card.TFrame", padding=(12, 10))
        card.grid(row=0, column=column, sticky="nsew", padx=(0 if column == 0 else 5, 0 if column == 2 else 5))
        ttk.Label(card, text=title, style="CardTitle.TLabel", anchor="e").pack(fill="x")
        ttk.Button(card, text=f"انتخاب {title}", style="Primary.TButton", command=lambda: self._choose_file(kind)).pack(fill="x", pady=(8, 6))
        ttk.Label(card, textvariable=selected, style="CardValue.TLabel", anchor="center", wraplength=230, justify="center").pack(fill="x")
        ttk.Label(card, text="فایل فعلی:", style="CardTitle.TLabel", anchor="e").pack(fill="x", pady=(9, 0))
        ttk.Label(card, textvariable=current, style="CardValue.TLabel", anchor="e", wraplength=230, justify="right").pack(fill="x", pady=(3, 0))

    def _append_log(self, message: str) -> None:
        self.log_box.configure(state="normal")
        self.log_box.insert("end", message.rstrip() + "\n")
        self.log_box.see("end")
        self.log_box.configure(state="disabled")

    def _refresh_sources(self) -> None:
        sources = find_sources(self.home_dir)
        self.daily_text.set(sources.daily.name if sources.daily else "پیدا نشد")
        self.manual_text.set(sources.manual.name if sources.manual else "اختیاری — پیدا نشد")
        self.facilities_text.set(sources.facilities.name if sources.facilities else "اختیاری — پیدا نشد")
        state = load_state(self.home_dir)
        if state.get("last_success"):
            self.last_run_text.set(f"آخرین گزارش: {state.get('report_date', '—')} | {state['last_success']}")

    def _choose_file(self, kind: str) -> None:
        titles = {
            "daily": "انتخاب گزارش روزانه خزانه",
            "manual": "انتخاب فایل ورودی‌های دستی",
            "facilities": "انتخاب گزارش تسهیلات",
        }
        selected = filedialog.askopenfilename(
            parent=self,
            title=titles[kind],
            filetypes=[("Excel", "*.xlsx")],
        )
        if not selected:
            return
        path = Path(selected)
        try:
            detected = classify_path(path)
        except Exception as error:
            messagebox.showerror("TreasuryFlow", str(error))
            return
        if detected != kind:
            detected_title = titles.get(detected, detected).replace("انتخاب ", "")
            messagebox.showerror("TreasuryFlow", f"فایل انتخاب‌شده مربوط به «{detected_title}» است. لطفاً آن را از بخش درست انتخاب کنید.")
            return
        self.selected_files[kind] = path
        variables = {
            "daily": self.selected_daily_text,
            "manual": self.selected_manual_text,
            "facilities": self.selected_facilities_text,
        }
        variables[kind].set(path.name)

    def _upload_selected(self) -> None:
        selected = list(self.selected_files.values())
        if not selected:
            messagebox.showinfo("TreasuryFlow", "ابتدا حداقل یک فایل را از بخش مربوط به آن انتخاب کنید.")
            return
        if self.worker_running:
            messagebox.showinfo("TreasuryFlow", "پردازش قبلی هنوز در حال اجراست.")
            return
        self.worker_running = True
        self.status_text.set("در حال دریافت و شناسایی فایل‌ها…")

        def worker() -> None:
            try:
                imported = import_files(self.home_dir, [Path(item) for item in selected])
                mark_upload_request(self.home_dir, imported)
                self.events.put(("log", "فایل‌های دریافت‌شده: " + "، ".join(path.name for path in imported)))
                self.events.put(("uploaded", None))
                if self.processor_enabled:
                    result = process_sources(self.home_dir, force=True, log=lambda text: self.events.put(("log", text)))
                    self.events.put(("done", result))
                else:
                    self.events.put(("upload_only_done", imported))
            except Exception as error:
                self.events.put(("error", error))

        threading.Thread(target=worker, daemon=True).start()

    def _start_process(self, force: bool = False) -> None:
        if self.worker_running:
            return
        self.worker_running = True
        self.status_text.set("در حال ساخت داشبورد جدید…")

        def worker() -> None:
            try:
                result = process_sources(self.home_dir, force=force, log=lambda text: self.events.put(("log", text)))
                self.events.put(("done", result))
            except Exception as error:
                self.events.put(("error", error))

        threading.Thread(target=worker, daemon=True).start()

    def _drain_events(self) -> None:
        try:
            while True:
                kind, payload = self.events.get_nowait()
                if kind == "log":
                    self._append_log(str(payload))
                elif kind == "uploaded":
                    self.selected_files.clear()
                    self.selected_daily_text.set("فایلی انتخاب نشده")
                    self.selected_manual_text.set("فایلی انتخاب نشده")
                    self.selected_facilities_text.set("فایلی انتخاب نشده")
                elif kind == "done":
                    self.worker_running = False
                    self._refresh_sources()
                    if payload is None:
                        self.status_text.set("داشبورد با فایل‌های فعلی به‌روز است.")
                    else:
                        self.status_text.set(f"گزارش {payload.report_date} با موفقیت آماده شد.")
                elif kind == "upload_only_done":
                    self.worker_running = False
                    self._refresh_sources()
                    self.status_text.set("فایل‌ها ارسال شدند؛ سیستم اصلی آن‌ها را پردازش می‌کند.")
                    messagebox.showinfo("TreasuryFlow", "فایل‌ها با موفقیت ارسال شدند. پردازش و انتشار روی سیستم اصلی انجام می‌شود.")
                elif kind == "error":
                    self.worker_running = False
                    error = payload
                    friendly = str(error) if isinstance(error, TreasuryFlowError) else f"خطای غیرمنتظره: {error}"
                    self.status_text.set("ساخت گزارش ناموفق بود؛ جزئیات را بررسی کنید.")
                    self._append_log(friendly)
                    messagebox.showerror("TreasuryFlow", friendly)
        except queue.Empty:
            pass
        self.after(150, self._drain_events)

    def _auto_check(self) -> None:
        if not self.processor_enabled:
            if not self.worker_running:
                self.status_text.set("ایستگاه بارگذاری؛ پردازش روی سیستم اصلی انجام می‌شود.")
        elif self.auto_enabled.get() and not self.worker_running:
            try:
                self._refresh_sources()
                if has_upload_request(self.home_dir):
                    self._append_log("درخواست جدید بارگذاری از شبکه دریافت شد.")
                    self._start_process(True)
                elif has_changed(self.home_dir):
                    self._append_log("تغییر در فایل‌های ورودی تشخیص داده شد.")
                    self._start_process(False)
                elif find_sources(self.home_dir).daily:
                    self.status_text.set("پوشه زیر نظر است؛ فایل جدید خودکار پردازش می‌شود.")
                else:
                    self.status_text.set("منتظر فایل گزارش روزانه خزانه…")
            except Exception as error:
                self._append_log(f"بررسی خودکار: {error}")
        self.after(self.POLL_MS, self._auto_check)

    def _open_dashboard(self) -> None:
        target = self.home_dir / "index.html"
        if not target.exists():
            messagebox.showinfo("TreasuryFlow", "هنوز داشبوردی ساخته نشده است.")
            return
        webbrowser.open(target.as_uri())

    def _open_folder(self) -> None:
        os.startfile(self.home_dir)  # type: ignore[attr-defined]


if __name__ == "__main__":
    if "--once" in sys.argv:
        raise SystemExit(run_once_in_background())
    TreasuryFlowApp().mainloop()
