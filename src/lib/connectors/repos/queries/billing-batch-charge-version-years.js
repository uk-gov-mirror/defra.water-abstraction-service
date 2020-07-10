exports.findStatusCountsByBatchId = `
select status, count(*) 
  from water.billing_batch_charge_version_years y
  where billing_batch_id = :batchId
  group by status
`;

exports.deleteByInvoiceId = `
delete from water.billing_batch_charge_version_years y
  using 
    water.billing_invoices i, 
    water.billing_invoice_licences l,
    water.billing_transactions t,
    water.charge_elements e
  where i.billing_invoice_id=:billingInvoiceId 
    and i.billing_invoice_id=l.billing_invoice_id 
    and t.billing_invoice_licence_id=l.billing_invoice_licence_id 
    and t.charge_element_id=e.charge_element_id 
    and y.charge_version_id=e.charge_version_id
    and y.financial_year_ending=i.financial_year_ending
`;

exports.createForBatch = `
insert into water.billing_batch_charge_version_years
  (billing_batch_id, charge_version_id, financial_year_ending, status)

  select bcv.billing_batch_id, bcv.charge_version_id, fy.financial_year_ending, 'processing' as status
    from water.billing_batch_charge_versions bcv
    join water.charge_versions cv on bcv.charge_version_id=cv.charge_version_id
    join
  (
    select 
      generate_series(from_financial_year_ending, to_financial_year_ending) as financial_year_ending,
      make_date(generate_series(from_financial_year_ending-1, to_financial_year_ending-1), 4,1) as min_date,
      make_date(generate_series(from_financial_year_ending, to_financial_year_ending), 3,31 ) as max_date
      from water.billing_batches b where b.billing_batch_id=:billingBatchId
  ) fy on cv.start_date<=fy.max_date and (cv.end_date is null or cv.end_date>=fy.min_date)

  where bcv.billing_batch_id=:billingBatchId

  returning *
`;
