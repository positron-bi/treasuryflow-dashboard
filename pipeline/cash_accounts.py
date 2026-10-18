"""Read cash balances by their source headers rather than column positions."""


def read_cash_accounts(sheet, valid_company_names, company_key, rial_per_million_toman):
    headers = [str(cell.value or "").strip().casefold() for cell in sheet[5]]

    def column(name):
        matches = [i for i, header in enumerate(headers) if header == name.casefold()]
        if len(matches) != 1:
            raise ValueError(f"ستون «{name}» در ردیف عنوان شیت Cash پیدا نشد یا تکراری است.")
        return matches[0]

    company = column("Co.")
    bank = column("Bank - Account")
    account_number = column("Account Number")
    available = column("Bank Available")
    # Cash also has a second Deposit field. The blocked bank deposit is the
    # one immediately associated with Bank Available, to its left.
    deposits = [i for i, header in enumerate(headers) if header == "deposit" and i < available]
    if len(deposits) != 1:
        raise ValueError("ستون سپرده مسدود پیش از «Bank Available» در شیت Cash نامشخص است.")
    deposit = deposits[0]

    accounts = []
    for row in sheet.iter_rows(min_row=6, values_only=True):
        name = row[company]
        balance = row[available]
        if name is None or str(name).strip() not in valid_company_names or not isinstance(balance, (int, float)):
            continue
        blocked = row[deposit]
        accounts.append({
            "co": company_key(name),
            "bank": str(row[bank] or "").strip(),
            "acct": str(row[account_number] or ""),
            "bal": float(balance) / rial_per_million_toman,
            "blocked": float(blocked) / rial_per_million_toman if isinstance(blocked, (int, float)) else 0,
        })
    return accounts
