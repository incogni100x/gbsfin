update public.deposit_instructions
set
  beneficiary_name = 'Global Stripe Fin',
  account_number = case currency_code
    when 'USD' then '8675309124'
    when 'AUD' then '493821765'
    when 'GBP' then '83619472'
    when 'NZD' then '12-3456-0789123-00'
    else account_number
  end,
  routing_number = case currency_code
    when 'USD' then '123456780'
    else routing_number
  end,
  iban = case currency_code
    when 'EUR' then 'DE70500105171234567890'
    when 'AED' then 'AE070331234567890123456'
    when 'GBP' then 'GB38GSFN20456783619472'
    else iban
  end,
  swift_bic = case currency_code
    when 'USD' then 'GSFNUS33XXX'
    when 'EUR' then 'GSFNDEFFXXX'
    when 'AUD' then 'GSFNAU2SXXX'
    when 'AED' then 'GSFNAEADXXX'
    when 'MXN' then 'GSFNMXMMXXX'
    when 'GBP' then 'GSFNGB2LXXX'
    when 'NZD' then 'GSFNNZ2WXXX'
    else swift_bic
  end,
  sort_code = case currency_code
    when 'GBP' then '20-45-67'
    else sort_code
  end,
  bsb = case currency_code
    when 'AUD' then '923-100'
    else bsb
  end,
  clabe = case currency_code
    when 'MXN' then '646180157034280175'
    else clabe
  end
where currency_code in ('USD', 'EUR', 'AUD', 'AED', 'MXN', 'GBP', 'NZD');
