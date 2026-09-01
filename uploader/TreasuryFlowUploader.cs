using System;
using System.Drawing;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace Positron.TreasuryFlow
{
    internal sealed class UploaderForm : Form
    {
        private readonly string sharedHome;
        private readonly string[] selected = new string[3];
        private readonly Label[] labels = new Label[3];
        private readonly string[] titles = { "گزارش روزانه خزانه", "ورودی‌های دستی", "گزارش تسهیلات" };

        internal UploaderForm(string uploadHome)
        {
            sharedHome = String.IsNullOrWhiteSpace(uploadHome)
                ? AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar)
                : Path.GetFullPath(uploadHome).TrimEnd(Path.DirectorySeparatorChar);
            Text = "آپلود فایل‌های TreasuryFlow";
            RightToLeft = RightToLeft.Yes;
            RightToLeftLayout = true;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(560, 430);
            MinimumSize = new Size(580, 470);
            Font = new Font("Tahoma", 9F);
            BackColor = Color.FromArgb(246, 248, 251);

            Label heading = new Label();
            heading.Text = "آپلود فایل‌های گزارش جریان نقد";
            heading.Font = new Font("Tahoma", 15F, FontStyle.Bold);
            heading.TextAlign = ContentAlignment.MiddleCenter;
            heading.SetBounds(30, 20, 500, 42);
            Controls.Add(heading);

            Label note = new Label();
            note.Text = "هر فایل را از بخش مربوط به خودش انتخاب کنید.";
            note.ForeColor = Color.DimGray;
            note.TextAlign = ContentAlignment.MiddleCenter;
            note.SetBounds(30, 62, 500, 28);
            Controls.Add(note);

            for (int i = 0; i < 3; i++) AddPicker(i, 102 + i * 76);

            Button upload = new Button();
            upload.Text = "ارسال فایل‌های انتخاب‌شده";
            upload.Font = new Font("Tahoma", 10F, FontStyle.Bold);
            upload.BackColor = Color.FromArgb(22, 163, 74);
            upload.ForeColor = Color.White;
            upload.FlatStyle = FlatStyle.Flat;
            upload.FlatAppearance.BorderSize = 0;
            upload.Cursor = Cursors.Hand;
            upload.SetBounds(145, 346, 270, 46);
            upload.Click += UploadClicked;
            Controls.Add(upload);
        }

        private void AddPicker(int index, int y)
        {
            Button pick = new Button();
            pick.Text = "انتخاب " + titles[index];
            pick.Tag = index;
            pick.SetBounds(270, y, 245, 34);
            pick.Click += PickClicked;
            Controls.Add(pick);

            labels[index] = new Label();
            labels[index].Text = "انتخاب نشده";
            labels[index].ForeColor = Color.Gray;
            labels[index].TextAlign = ContentAlignment.MiddleRight;
            labels[index].AutoEllipsis = true;
            labels[index].SetBounds(35, y, 220, 34);
            Controls.Add(labels[index]);
        }

        private void PickClicked(object sender, EventArgs e)
        {
            int index = (int)((Button)sender).Tag;
            using (OpenFileDialog dialog = new OpenFileDialog())
            {
                dialog.Title = "انتخاب " + titles[index];
                dialog.Filter = "فایل اکسل (*.xlsx)|*.xlsx";
                dialog.Multiselect = false;
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                selected[index] = dialog.FileName;
                labels[index].Text = Path.GetFileName(dialog.FileName);
                labels[index].ForeColor = Color.FromArgb(21, 43, 66);
            }
        }

        private void UploadClicked(object sender, EventArgs e)
        {
            int count = 0;
            for (int i = 0; i < selected.Length; i++) if (!String.IsNullOrEmpty(selected[i])) count++;
            if (count == 0)
            {
                MessageBox.Show(this, "ابتدا حداقل یک فایل را انتخاب کنید.", "TreasuryFlow", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            try
            {
                string[] uploaded = new string[count];
                int position = 0;
                for (int i = 0; i < selected.Length; i++)
                {
                    if (String.IsNullOrEmpty(selected[i])) continue;
                    string destinationName = DestinationName(i, selected[i]);
                    string destination = Path.Combine(sharedHome, destinationName);
                    string pending = destination + ".uploading-" + Guid.NewGuid().ToString("N");
                    File.Copy(selected[i], pending, true);
                    File.Copy(pending, destination, true);
                    File.Delete(pending);
                    uploaded[position++] = destinationName;
                }
                WriteRequest(uploaded);
                for (int i = 0; i < selected.Length; i++) { selected[i] = null; labels[i].Text = "انتخاب نشده"; labels[i].ForeColor = Color.Gray; }
                MessageBox.Show(this, "فایل‌ها با موفقیت ارسال شدند. پردازش روی سیستم اصلی انجام می‌شود.", "TreasuryFlow", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show(this, "ارسال فایل‌ها ناموفق بود:\r\n" + ex.Message, "TreasuryFlow", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static string DestinationName(int index, string source)
        {
            if (index == 1) return "Manual_Inputs.xlsx";
            if (index == 2) return "گزارش تسهیلات.xlsx";
            string normalized = NormalizeDigits(Path.GetFileNameWithoutExtension(source));
            Match match = Regex.Match(normalized, @"(14\d{2})[-_/](\d{1,2})[-_/](\d{1,2})");
            if (!match.Success) throw new InvalidOperationException("تاریخ گزارش روزانه از نام فایل پیدا نشد. نام فایل باید شامل تاریخی مانند 1405-06-10 باشد.");
            return String.Format("Treasury Daily Report - {0}-{1:00}-{2:00}.xlsx", match.Groups[1].Value, Int32.Parse(match.Groups[2].Value), Int32.Parse(match.Groups[3].Value));
        }

        private static string NormalizeDigits(string value)
        {
            const string fa = "۰۱۲۳۴۵۶۷۸۹";
            const string ar = "٠١٢٣٤٥٦٧٨٩";
            StringBuilder result = new StringBuilder(value.Length);
            foreach (char c in value)
            {
                int i = fa.IndexOf(c); if (i >= 0) { result.Append((char)('0' + i)); continue; }
                i = ar.IndexOf(c); if (i >= 0) { result.Append((char)('0' + i)); continue; }
                result.Append(c);
            }
            return result.ToString();
        }

        private void WriteRequest(string[] files)
        {
            string stateDir = Path.Combine(sharedHome, ".treasuryflow");
            Directory.CreateDirectory(stateDir);
            string target = Path.Combine(stateDir, "upload_request.json");
            string pending = target + ".pending-" + Guid.NewGuid().ToString("N");
            StringBuilder names = new StringBuilder();
            for (int i = 0; i < files.Length; i++)
            {
                if (i > 0) names.Append(',');
                names.Append('"').Append(JsonEscape(files[i])).Append('"');
            }
            string json = "{\"id\":\"" + Guid.NewGuid().ToString() + "\",\"uploaded_at\":\"" + DateTimeOffset.Now.ToString("o") + "\",\"files\":[" + names + "]}";
            File.WriteAllText(pending, json, new UTF8Encoding(false));
            File.Copy(pending, target, true);
            File.Delete(pending);
        }

        private static string JsonEscape(string value)
        {
            return value.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r").Replace("\n", "\\n");
        }
    }

    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new UploaderForm(args.Length > 0 ? args[0] : null));
        }
    }
}
