/* Rental invoices: explicit cycle allocation; historical payments remain unassigned. */
(function(){
  const dateLabel=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('-'):value||'—';
  function materialRows(br){
    const rows=[];
    for(const x of br.lines_materials||[]){
      if(Number(x.qty)<=0)continue;
      rows.push([esc(x.label),Number(x.qty),money(x.amount)]);
    }
    for(const [k,label] of WOODS){
      const w=br.wood_totals?.[k];if(!w||Number(w.total_feet)<=0)continue;
      rows.push([esc(label)+(w.text&&w.text!=='0'?`<small class="sub">${esc(w.text)}</small>`:''),`${Number(w.total_feet)} ft`,money(w.amount)]);
    }
    return rows.map((r,n)=>`<tr><td>${n+1}</td>${r.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="4">No materials in this cycle</td></tr>';
  }
  function paymentCycle(b,p){
    // Never infer an old payment's cycle from its collection date.
    return (b.cycles||[]).find(c=>Number(p.cycle_index)===c.index&&p.cycle_start_date===c.start_date&&p.cycle_end_date===c.end_date);
  }
  function words(amount){
    const one=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
    const tens=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
    const say=n=>n<20?one[n]:n<100?tens[Math.floor(n/10)]+(n%10?' '+one[n%10]:''):n<1000?say(Math.floor(n/100))+' hundred'+(n%100?' '+say(n%100):''):n<100000?say(Math.floor(n/1000))+' thousand'+(n%1000?' '+say(n%1000):''):n<10000000?say(Math.floor(n/100000))+' lakh'+(n%100000?' '+say(n%100000):''):say(Math.floor(n/10000000))+' crore'+(n%10000000?' '+say(n%10000000):'');
    const paise=Math.round(Number(amount)*100);
    if(!Number.isSafeInteger(paise)||paise<0)return '';
    return 'Rupees '+say(Math.floor(paise/100))+(paise%100?' and '+say(paise%100)+' paise':'')+' only';
  }
  SA.rentalInvoiceBrand=()=>`<header class="rent-brand"><div class="rent-brand-name"><span>S.A</span> TRADERS</div><div class="rent-brand-tag">SCAFFOLDING &amp; CENTRING MATERIAL RENTAL</div><p>${esc(BUSINESS.address)}<br><b>${esc(BUSINESS.phone)}</b></p><svg class="rent-scaffold" viewBox="0 0 90 100" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v86M38 2v92M64 8v86M84 18v76M6 24h82M6 46h82M6 68h82M6 90h82M12 24l26 22-26 22 26 22M38 24l26 22-26 22 26 22M64 24l20 22-20 22 20 22"/></g></svg></header>`;
  SA.rentalInvoiceRows=materialRows;
  SA.rentalInvoiceDate=dateLabel;
  renderPrintInvoice=async function(no,mode='invoice',selectedIndex){
    const b=await hydratedBillByNo(no);
    if(!b){toast('Bill not found','danger');return}
    const cycles=b.cycles||[];
    const cycle=cycles.find(c=>c.index===Number(selectedIndex))||cycles[cycles.length-1];
    const snap=cycle||{snapshot_qty:b.base_qty,snapshot_wood:b.base_wood_maps};
    const br=calcRent(snap.snapshot_qty,snap.snapshot_wood,b.rates);
    const terms=await setting('terms_invoice',DEFAULT_TERMS);
    const payments=b.payments||[],assigned=payments.filter(p=>cycle&&paymentCycle(b,p)?.index===cycle.index);
    const paid=round2(sum(assigned.map(p=>Number(p.amount)||0)));
    const unassigned=round2(sum(payments.filter(p=>!paymentCycle(b,p)).map(p=>Number(p.amount)||0)));
    const title=`Invoice #${b.bill_no} · Cycle #${cycle?.index||'—'}`;
    const allCycles=cycles.length>1;
    printShell(`<div class="invoice-page rent-invoice" data-share-name="${esc(title)}">
      <div class="invoice-toolbar no-print"><button class="invoice-circle" aria-label="Go back" onclick="SA.back()">‹</button><h1>Rent bill</h1><button class="invoice-circle" aria-label="Share invoice to customer WhatsApp" onclick="SA.shareInvoiceWhatsApp(this,'${esc(b.mobile||'')}')">↗</button></div>
      ${allCycles?`<label class="rent-cycle-select no-print">Invoice for rental cycle<select class="sa-input" id="invoiceCycle">${cycles.map(c=>`<option value="${c.index}" ${c.index===cycle?.index?'selected':''}>Cycle #${c.index} · ${dateLabel(c.start_date)} to ${dateLabel(c.end_date)}</option>`).join('')}</select></label>`:''}
      <section class="invoice-sheet">
        ${SA.rentalInvoiceBrand()}
        <div class="invoice-body">
          <div class="rent-heading"><div><h2>RENT <span>BILL</span></h2><small>MATERIAL RENTAL SERVICES</small></div><div class="invoice-no">Bill #${esc(b.bill_no)}<span>Issued ${dateLabel(b.start_date)}</span></div></div>
          <div class="invoice-customer"><div class="invoice-field"><span>Customer name</span><strong>${esc(b.name||'—')}</strong></div><div class="invoice-field"><span>Mobile no.</span><strong>${esc(b.mobile||'—')}</strong></div><div class="invoice-field rent-place"><span>Site / Place</span><strong>${esc(b.place||'—')}</strong></div></div>
          <div class="rent-period"><div><small>RENTAL CYCLE</small><strong>Cycle #${cycle?.index||'—'}</strong></div><div><strong>${dateLabel(cycle?.start_date||b.start_date)} to ${dateLabel(cycle?.end_date)}</strong><span>${i(b.cycle_days)} days · materials and rent below</span></div></div>
          <table class="invoice-materials rent-materials"><thead><tr><th>#</th><th>Material</th><th>Qty</th><th>Amount ₹</th></tr></thead><tbody>${materialRows(br)}</tbody></table>
          <div class="rent-cycle-totals"><div><span>Rent · Cycle #${cycle?.index||'—'}</span><strong>${money(br.rent_total)}</strong></div>${Number(cycle?.transport)>0?`<div><span>Transport / handling</span><strong>${money(cycle.transport)}</strong></div>`:''}${Number(cycle?.rent)>br.rent_total?`<div><span>Other cycle charges / deposit</span><strong>${money(round2(cycle.rent-br.rent_total))}</strong></div>`:''}<div><span>Cycle charges</span><strong>${money(cycle?.total||0)}</strong></div><div class="rent-paid"><span>Paid for Cycle #${cycle?.index||'—'}</span><strong>${money(paid)}</strong></div></div>
          ${assigned.length?`<div class="rent-receipts"><h3>Payments · Cycle #${cycle.index}</h3>${assigned.map(p=>`<div><span>${esc(dateLabel(p.payment_date||p.date))}${p.method?` · ${esc(p.method)}`:''}</span><strong>${money(p.amount)}</strong></div>`).join('')}</div>`:''}
          ${unassigned!==0?`<p class="rent-unassigned">${money(unassigned)} in payments: cycle not recorded. Included in total paid below.</p>`:''}
          <div class="rent-account-title">BILL ACCOUNT · ${allCycles?`ALL ${cycles.length} RENTAL CYCLES`:'CYCLE #'+(cycle?.index||'—')}</div>
          <div class="rent-account"><div><span>Total charges</span><strong>${money(b.total_due)}</strong></div><div><span>Total paid</span><strong>${money(b.total_paid)}</strong></div><div><span>Advance deposit</span><strong>${money(b.advance_locked)}</strong></div></div>
          <div class="invoice-total"><span>Balance due${allCycles?'<small>All cycles combined</small>':''}</span><strong>${money(b.pending)}</strong></div>
          <div class="rent-words"><span>Balance in words</span><strong>${esc(words(b.pending))}</strong></div>
          <div class="rent-signatures"><span>Customer signature</span><span>For S.A Traders</span></div>
        </div>
      </section>
      <details class="invoice-terms" data-share-exclude><summary>Terms &amp; Conditions</summary><div class="invoice-terms-body">${textToHtml(terms)}</div></details>
      <div class="invoice-actions no-print"><button class="share-image" onclick="SA.shareInvoiceWhatsApp(this,'${esc(b.mobile||'')}')">WhatsApp customer</button><button class="print" onclick="SA.printNow(document.title)">Print / PDF</button></div>
    </div>`);
    document.title=BUSINESS.name+' - '+title;
    const selector=document.getElementById('invoiceCycle');
    if(selector)selector.onchange=()=>renderPrintInvoice(no,mode,Number(selector.value));
  };
})();
