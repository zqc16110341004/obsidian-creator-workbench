// Presentation state stays separate from saved tasks and model conversations.
export function rememberAssistant(ui) {
  const panel=document.querySelector('.assistant-panel');
  if(!panel)return;
  const input=panel.querySelector('#chat-form textarea'),history=panel.querySelector('.chat-history');
  const id=panel.dataset.taskId;
  ui.chatPositions??={};
  if(history&&panel.getClientRects().length){
    const children=[...history.children],top=history.getBoundingClientRect().top;
    const index=children.findIndex(child=>child.getBoundingClientRect().bottom>top);
    ui.chatPositions[id]={index,offset:index<0?0:children[index].getBoundingClientRect().top-top,bottom:history.scrollHeight-history.clientHeight-history.scrollTop<24};
  }
  ui.chatSelection=input&&document.activeElement===input?{id,start:input.selectionStart,end:input.selectionEnd}:null;
}

export function releaseAssistant() {
  const dialog=document.querySelector('#co-creation-dialog');
  if(!dialog)return;
  const panel=dialog.querySelector('.assistant-panel'),layout=document.querySelector('.studio-layout');
  if(panel&&layout)layout.append(panel);
  dialog.close();dialog.remove();
}

export function restoreAssistant(ui) {
  const panel=document.querySelector('.assistant-panel');if(!panel)return;
  const id=panel.dataset.taskId,history=panel.querySelector('.chat-history'),position=ui.chatPositions?.[id];
  if(history){
    if(!position||position.bottom)history.scrollTop=history.scrollHeight;
    else {const anchor=history.children[position.index];if(anchor)history.scrollTop+=anchor.getBoundingClientRect().top-history.getBoundingClientRect().top-position.offset;}
  }
  if(ui.chatSelection?.id===id&&ui.assistantMode!=='collapsed'){
    const input=panel.querySelector('#chat-form textarea');
    input?.focus({preventScroll:true});input?.setSelectionRange(ui.chatSelection.start,ui.chatSelection.end);
  }
}

export function mountAssistant(ui,onModeChange) {
  const panel=document.querySelector('.assistant-panel');if(!panel)return;
  if(ui.assistantMode==='expanded'){
    const dialog=document.createElement('dialog');dialog.id='co-creation-dialog';
    dialog.setAttribute('aria-labelledby','assistant-title');
    document.body.append(dialog);dialog.append(panel);dialog.showModal();
    dialog.addEventListener('cancel',event=>{event.preventDefault();onModeChange('docked');});
  }
  restoreAssistant(ui);
}
