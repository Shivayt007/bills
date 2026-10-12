/* Mobile invoice override. Keeps billing calculations/data in app.js. */
(function(){
  function invoiceMaterialRows(br){
    const rows=[];
    for(const x of (br.lines_materials||[])){
      const qty=Number(x.qty)||0, amount=Number(x.amount)||0;
      if(qty<=0 || amount<=0) continue;
      rows.push(`<tr><td>${esc(x.label)}</td><td>${qty}</td><td>${money(x.rate)}</td><td>${money(amount)}</td></tr>`);
    }
    for(const [k,label] of WOODS){
      const w=br.wood_totals?.[k];
      if(!w) continue;
      const feet=Number(w.total_feet)||0, amount=Number(w.amount)||0;
      if(feet<=0 || amount<=0) continue;
      const desc=(w.text && w.text!=='0')?`<span class="sub">${esc(w.text)}</span>`:'';
      rows.push(`<tr><td>${esc(label)}${desc}</td><td>${feet} ft</td><td>${money(w.rate)}</td><td>${money(amount)}</td></tr>`);
    }
    return rows.length?rows.join(''):`<tr><td colspan="4" style="text-align:center;color:#677a77;padding:18px">No chargeable materials</td></tr>`;
  }

  function invoiceCycles(b){
    const cycles=b.cycles||[];
    if(!cycles.length) return '<div class="empty">No rental cycles.</div>';
    return cycles.map(c=>`<div class="invoice-cycle-card"><div class="invoice-cycle-index">#${i(c.index)}</div><div class="invoice-cycle-dates"><strong>${esc(c.start_date)} → ${esc(c.end_date)}</strong><span>Rent ${money(c.rent)}${Number(c.transport)>0?` · Transport ${money(c.transport)}`:''}</span></div><div class="invoice-cycle-money"><strong>${money(c.total)}</strong><small>cycle total</small></div></div>`).join('');
  }

  renderPrintInvoice=async function(no,mode='invoice'){
    const raw=await DB.get('bills',no);
    if(!raw){toast('Bill not found','danger');return}
    const b=hydrateBill(raw);
    const snap=b.cycles?.[b.cycles.length-1]||{snapshot_qty:b.base_qty,snapshot_wood:b.base_wood_maps};
    const br=calcRent(snap.snapshot_qty,snap.snapshot_wood,b.rates);
    const terms=await setting('terms_invoice',DEFAULT_TERMS);
    const cycle=b.cycles?.[b.cycles.length-1];
    const from=cycle?.start_date||b.start_date||'-';
    const to=cycle?.end_date||'-';
    const title=mode==='customer'?`Customer Bill #${b.bill_no}`:`Invoice #${b.bill_no}`;
    const tr=Number(cycle?.transport||0);

    printShell(`<div class="invoice-page">
      <div class="invoice-toolbar no-print"><button class="invoice-circle" onclick="SA.back()">‹</button><h1>${mode==='customer'?'Customer Bill':'Invoice'}</h1><button class="invoice-circle" aria-label="Share invoice image" onclick="SA.shareInvoiceImage(this)">↗</button></div>
      <section class="invoice-sheet">
        <div class="invoice-brand"><div><h2>${esc(BUSINESS.name)}</h2><p>${esc(BUSINESS.address)}<br>${esc(BUSINESS.phone)}</p></div><div class="invoice-no">${esc(title).toUpperCase()}</div></div>
        <div class="invoice-body">
          <div class="invoice-customer"><div class="invoice-field"><span>Customer</span><strong>${esc(b.name||'-')}</strong></div><div class="invoice-field"><span>Mobile</span><strong>${esc(b.mobile||'-')}</strong></div><div class="invoice-field"><span>Place</span><strong>${esc(b.place||'-')}</strong></div><div class="invoice-field"><span>Bill no</span><strong>${esc(b.bill_no)}</strong></div></div>
          <div class="invoice-cyclebar"><span>${esc(from)}</span><span>${i(b.cycle_days)} DAY CYCLE</span><span>${esc(to)}</span></div>
          <table class="invoice-materials"><thead><tr><th>Material</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${invoiceMaterialRows(br)}</tbody></table>
          <div class="invoice-breakdown"><div class="invoice-breakdown-row"><span>Cycle rent</span><strong>${money(br.rent_total)}</strong></div>${tr>0?`<div class="invoice-breakdown-row"><span>Transport</span><strong>${money(tr)}</strong></div>`:''}</div>
          <div class="invoice-total"><span>Total due</span><strong>${money(b.total_due)}</strong></div>
          <div class="invoice-pay-grid"><div class="invoice-paybox paid"><span>Paid</span><strong>${money(b.total_paid)}</strong></div><div class="invoice-paybox pending"><span>Pending</span><strong>${money(b.pending)}</strong></div><div class="invoice-paybox"><span>Advance</span><strong>${money(b.advance_locked)}</strong></div></div>
        </div>
      </section>
      <section class="invoice-cycle-section"><h3>Rental Cycle Summary</h3><div class="invoice-cycle-list">${invoiceCycles(b)}</div></section>
      <details class="invoice-terms"><summary>Terms & Conditions</summary><div class="invoice-terms-body">${textToHtml(terms)}</div></details>
      <div class="invoice-actions no-print"><button class="print" onclick="SA.printNow('${esc(BUSINESS.name+' - '+title)}')">▣ &nbsp; Print / Save PDF</button><button class="share-image" onclick="SA.shareInvoiceImage(this)">Share image</button></div>
    </div>`);
  };
})();

