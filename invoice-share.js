/* Local PNG export + Android Sharesheet. No network service or automatic sending. */
(function(){
  let sharing=false;
  async function shareInvoice(button,mobile=''){
    if(sharing)return;
    const source=document.querySelector('.invoice-page')||document.querySelector('.print-sheet');
    if(!source){toast('Open an invoice first.','warning');return}
    if(typeof html2canvas!=='function'){toast('Image export is unavailable. Reinstall the latest APK.','danger');return}
    sharing=true;
    const previous=button?.innerHTML;
    if(button){button.disabled=true;button.textContent='Preparing…';}
    let staging;
    try {
      if(document.fonts?.ready)await document.fonts.ready;
      staging=document.createElement('div');staging.className='invoice-image-stage';
      staging.style.cssText='position:fixed;left:-10000px;top:0;width:390px;pointer-events:none;';
      staging.setAttribute('aria-hidden','true');
      const copy=source.cloneNode(true);
      copy.querySelectorAll('.no-print,.invoice-toolbar,.invoice-actions,.invoice-terms,[data-share-exclude],button,script').forEach(node=>node.remove());
      copy.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
      copy.querySelectorAll('details').forEach(node=>node.open=true);
      copy.removeAttribute('id');copy.classList.add('invoice-image-copy');
      staging.appendChild(copy);document.body.appendChild(staging);
      const height=Math.ceil(copy.getBoundingClientRect().height);
      if(height<1||height>16000)throw new Error('This invoice is too long for one image. Use Print / Save PDF.');
      const scale=Math.min(2,Math.sqrt(12000000/(390*height)));
      const canvas=await html2canvas(copy,{backgroundColor:'#ffffff',scale,logging:false,useCORS:false,allowTaint:false,scrollX:0,scrollY:0,width:390,height,windowWidth:390});
      const data=canvas.toDataURL('image/png');
      if(data.length>16*1024*1024)throw new Error('Image is too large. Use Print / Save PDF.');
      const no=(source.dataset.shareName||source.querySelector('.invoice-no')?.textContent||'Invoice').trim().replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,60);
      const filename='SA-Traders-'+no+'.png';
      if(mobile&&window.Android?.shareInvoiceToWhatsApp){
        const result=Android.shareInvoiceToWhatsApp(data,filename,String(mobile));
        if(result!=='ok')throw new Error(result||'Could not open WhatsApp.');
      } else if(window.Android?.shareInvoiceImage){
        const result=Android.shareInvoiceImage(data,filename);
        if(result!=='ok')throw new Error(result||'Could not open sharing.');
      } else {
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
        if(!blob)throw new Error('Could not create invoice image.');
        const file=new File([blob],filename,{type:'image/png'});
        if(navigator.canShare?.({files:[file]})){
          await navigator.share({files:[file],title:'S.A Traders invoice'});
        } else {
          const url=URL.createObjectURL(blob),link=document.createElement('a');
          link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
          setTimeout(()=>URL.revokeObjectURL(url),60000);
          toast('Invoice image downloaded. Share it from your files.');
        }
      }
    } catch(e){if(e.name!=='AbortError')toast(e.message||'Could not share invoice. Try Print / Save PDF.','danger');}
    finally {staging?.remove();sharing=false;if(button){button.disabled=false;button.innerHTML=previous;}}
  }
  SA.shareInvoiceImage=button=>shareInvoice(button,'');
  SA.shareInvoiceWhatsApp=(button,mobile)=>shareInvoice(button,mobile);
  SA.openCustomerWhatsApp=mobile=>{
    if(window.Android?.openWhatsAppChat){const result=Android.openWhatsAppChat(String(mobile));if(result!=='ok')toast(result,'danger');return}
    window.open(`https://wa.me/${String(mobile).replace(/\D/g,'')}`,'_blank');
  };
  SA.callCustomer=mobile=>{
    if(window.Android?.callCustomer){Android.callCustomer(String(mobile));return}
    location.href=`tel:${String(mobile).replace(/[^0-9+]/g,'')}`;
  };
})();
