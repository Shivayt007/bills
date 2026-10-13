/* Next-cycle invoice mobile redesign. Business calculations remain in app.js. */
(function(){
  function nextCycleRows(br){
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

  renderPrintNextCycle=async function(no){
    const raw=await DB.get('bills',no);
    if(!raw){toast('Bill not found','danger');return}
    const b=hydrateBill(raw);
    const idx=(b.current_cycle_index||0)+1;
    const snap=snapshotForCycle(b,idx);
    const br=calcRent(snap.qty,snap.wood,b.rates);
    const start=parseDate(b.start_date), days=Math.max(i(b.cycle_days,30),1);
    const cs=addDays(start,(idx-1)*days), ce=addDays(cs,days-1);
    const from=ymd(cs), to=ymd(ce);
    const title=`Next Cycle Bill #${b.bill_no}`;
    const terms=await setting('terms_invoice',DEFAULT_TERMS);

    printShell(`<div class="invoice-page rent-invoice next-cycle-invoice">
      <div class="invoice-toolbar no-print"><button class="invoice-circle" onclick="SA.back()">‹</button><h1>Next Cycle Bill</h1><button class="invoice-circle" aria-label="Share invoice to customer WhatsApp" onclick="SA.shareInvoiceWhatsApp(this,'${esc(b.mobile||'')}')">↗</button></div>
      <section class="invoice-sheet">
        ${SA.rentalInvoiceBrand()}
        <div class="invoice-body">
          <div class="rent-heading"><div><h2>RENT <span>BILL</span></h2><small>NEXT CYCLE ESTIMATE</small></div><div class="invoice-no">Bill #${esc(b.bill_no)}<span>Cycle #${idx}</span></div></div>
          <div class="invoice-customer"><div class="invoice-field"><span>Customer</span><strong>${esc(b.name||'-')}</strong></div><div class="invoice-field"><span>Mobile</span><strong>${esc(b.mobile||'-')}</strong></div><div class="invoice-field"><span>Place</span><strong>${esc(b.place||'-')}</strong></div><div class="invoice-field"><span>Bill no</span><strong>${esc(b.bill_no)}</strong></div></div>
          <div class="rent-period"><div><small>RENTAL CYCLE</small><strong>Cycle #${idx}</strong></div><div><strong>${SA.rentalInvoiceDate(from)} to ${SA.rentalInvoiceDate(to)}</strong><span>${i(b.cycle_days)} days · upcoming cycle</span></div></div>
          <table class="invoice-materials rent-materials"><thead><tr><th>#</th><th>Material</th><th>Qty</th><th>Amount ₹</th></tr></thead><tbody>${SA.rentalInvoiceRows(br)}</tbody></table>
          <div class="invoice-breakdown"><div class="invoice-breakdown-row"><span>Next cycle rent</span><strong>${money(br.rent_total)}</strong></div></div>
          <div class="invoice-total"><span>Next cycle total</span><strong>${money(br.rent_total)}</strong></div>
          <div class="invoice-pay-grid"><div class="invoice-paybox paid"><span>Bill paid to date</span><strong>${money(b.total_paid)}</strong></div><div class="invoice-paybox pending"><span>Bill pending to date</span><strong>${money(b.pending)}</strong></div><div class="invoice-paybox"><span>Advance</span><strong>${money(b.advance_locked)}</strong></div></div>
          <div class="next-cycle-note">This is an upcoming cycle estimate. Payments shown are for the existing bill, not this upcoming cycle. Transport, loading and unloading are not charged again after the first cycle.</div>
        </div>
      </section>
      <details class="invoice-terms"><summary>Terms & Conditions</summary><div class="invoice-terms-body">${textToHtml(terms)}</div></details>
      <div class="invoice-actions no-print"><button class="share-image" onclick="SA.shareInvoiceWhatsApp(this,'${esc(b.mobile||'')}')">WhatsApp customer</button><button class="print" onclick="SA.printNow('${esc(BUSINESS.name+' - '+title)}')">Print / PDF</button></div>
    </div>`);
  };
})();

