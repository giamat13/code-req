// MCP Apps view: one self-contained HTML page rendered by the host (claude.ai) in a sandboxed iframe.
// It speaks the MCP Apps postMessage protocol directly (no bundler, no external scripts).
// Kinds: "detail" (rows, badges, action buttons), "list", "board" (status columns), "thread" (chat bubbles), "text".
// Rows/buttons with `call` run another tool in place; a Back button keeps a stack.
// Keep backticks and ${ out of the view code: it lives inside a String.raw template literal.
export const VIEW_URI = "ui://apprequest/card.html";
export const VIEW_MIME = "text/html;profile=mcp-app";
export const VIEW_CSP = { resourceDomains: [] as string[] };

export const VIEW_HTML = /* html */ String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#fff;--fg:#1d1b26;--mut:#6b6679;--line:#e6e6ee;--accent:#2f6fed;--soft:#f3f5fb}
:root[data-theme=dark]{--bg:#17161d;--fg:#ece9f5;--mut:#a29cb5;--line:#34323f;--accent:#7fa6ff;--soft:#23222c}
body{margin:0;font:14px/1.45 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
.card{padding:14px 16px}h1{margin:0;font-size:18px;color:var(--accent)}.sub{color:var(--mut);margin:2px 0 10px}
.row{padding:8px 0;border-top:1px solid var(--line);display:flex;gap:8px;align-items:baseline;justify-content:space-between}
.row.go{cursor:pointer}.row.go:hover{background:var(--soft)}.row .t{font-weight:600}.row .s{color:var(--mut);font-size:13px}
dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px;margin:8px 0 0}dt{color:var(--mut)}dd{margin:0;word-break:break-word;white-space:pre-wrap}
a{color:var(--accent)}.note{color:var(--mut);font-size:12px;margin-top:10px}
.badge{display:inline-block;border-radius:999px;padding:1px 9px;font-size:12px;background:var(--soft);border:1px solid var(--line);white-space:nowrap}
.b-new{color:#b45309}.b-in_progress{color:#2563eb}.b-done{color:#15803d}.b-declined,.b-cancelled{color:#b91c1c}
.btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
button{font:inherit;border:1px solid var(--line);background:var(--soft);color:var(--fg);border-radius:8px;padding:5px 10px;cursor:pointer}
button:hover{border-color:var(--accent)}button.back{margin-bottom:8px}
.board{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:8px}
.col{background:var(--soft);border-radius:10px;padding:8px}.col h2{margin:0 0 6px;font-size:13px;text-transform:capitalize}
.item{background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:6px 8px;margin-bottom:6px;cursor:pointer}
.item:hover{border-color:var(--accent)}.item .t{font-weight:600}.item .s{color:var(--mut);font-size:12px}
.msg{max-width:85%;border-radius:12px;padding:6px 10px;margin:6px 0;background:var(--soft);white-space:pre-wrap;word-break:break-word}
.msg.developer{margin-inline-start:auto;background:var(--accent);color:#fff}.msg .m{font-size:11px;opacity:.7}
</style></head><body><div id="root"></div><script>
(function(){
var root=document.getElementById("root"),nextId=2,pending={},stack=[],current=null;
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function add(p,c){if(c)p.appendChild(c);return p}
function send(m){parent.postMessage(Object.assign({jsonrpc:"2.0"},m),"*")}
function request(method,params){return new Promise(function(res,rej){var id=nextId++;pending[id]={res:res,rej:rej};send({id:id,method:method,params:params})})}
function size(){send({method:"ui/notifications/size-changed",params:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}})}
function theme(ctx){if(ctx&&ctx.theme)document.documentElement.setAttribute("data-theme",ctx.theme)}
function textOf(r){return(r&&r.content||[]).map(function(c){return c.text||""}).join("\n")}
function badge(s){var b=el("span","badge b-"+s,String(s).replace("_"," "));return b}
function autolink(dd,v){var s=String(v);if(/^https?:\/\/\S+$/.test(s)){var a=el("a",null,s);a.href=s;a.target="_blank";a.rel="noopener noreferrer";dd.appendChild(a)}else dd.textContent=s}
function buttons(c,list){if(!list||!list.length)return;var b=el("div","btns");list.forEach(function(a){var x=el("button",null,a.label);x.addEventListener("click",function(){go(a.call)});b.appendChild(x)});add(c,b)}
function detail(d){var c=el("div","card");var h=el("h1",null,(d.icon?d.icon+" ":"")+(d.name||""));add(c,h);
 if(d.subtitle)add(c,el("div","sub",d.subtitle));
 if(d.badges&&d.badges.length){var bw=el("div");d.badges.forEach(function(b){add(bw,badge(b));bw.appendChild(document.createTextNode(" "))});add(c,bw)}
 var dl=el("dl");(d.rows||[]).forEach(function(r){if(r[1]==null||r[1]==="")return;add(dl,el("dt",null,r[0]));var dd=el("dd");autolink(dd,r[1]);add(dl,dd)});add(c,dl);
 buttons(c,d.actions);if(d.sources)add(c,el("div","note","Source: "+d.sources));return c}
function item(it,cls){var r=el("div",cls);var l=el("div");add(l,el("div","t",(it.icon?it.icon+" ":"")+it.title));if(it.sub)add(l,el("div","s",it.sub));add(r,l);
 if(it.badge&&cls==="row")add(r,badge(it.badge));if(it.call){r.classList.add("go");r.addEventListener("click",function(){go(it.call)})}return r}
function list(d){var c=el("div","card");add(c,el("h1",null,d.title||""));if(d.sub)add(c,el("div","sub",d.sub));
 (d.items||[]).forEach(function(it){add(c,item(it,"row"))});if(d.sources)add(c,el("div","note","Source: "+d.sources));return c}
function board(d){var c=el("div","card");add(c,el("h1",null,d.title||""));var b=el("div","board");
 (d.columns||[]).forEach(function(col){var k=el("div","col");add(k,el("h2",null,col.title+" ("+(col.items||[]).length+")"));(col.items||[]).forEach(function(it){add(k,item(it,"item"))});add(b,k)});
 add(c,b);if(d.sources)add(c,el("div","note","Source: "+d.sources));return c}
function thread(d){var c=el("div","card");add(c,el("h1",null,d.title||"Thread"));
 if(!(d.messages||[]).length)add(c,el("div","sub","No messages yet."));
 (d.messages||[]).forEach(function(m){var b=el("div","msg "+m.role);add(b,el("div",null,m.text||""));add(b,el("div","m",m.role+(m.time?" · "+m.time:"")));add(c,b)});
 if(d.sources)add(c,el("div","note","Source: "+d.sources));return c}
function show(d){current=d;root.textContent="";
 if(stack.length){var bk=el("button","back","← Back");bk.addEventListener("click",function(){var p=stack.pop();show(p);});add(root,bk)}
 var f={list:list,detail:detail,board:board,thread:thread}[d.kind];
 if(f)add(root,f(d));else add(root,add(el("div","card"),el("div",null,d.text||"No visual data.")));size()}
function go(call){var prev=current;request("tools/call",call).then(function(r){var d=r&&r.structuredContent;if(prev)stack.push(prev);
  show(d&&!r.isError?d:{kind:"text",text:textOf(r)||"No result."})},function(e){show({kind:"text",text:"Could not load: "+(e&&e.message||"error")})})}
window.addEventListener("message",function(e){var m=e.data;if(!m||m.jsonrpc!=="2.0")return;
 if(m.id!=null&&pending[m.id]&&(m.result!==undefined||m.error)){var p=pending[m.id];delete pending[m.id];if(m.error)p.rej(m.error);else p.res(m.result);return}
 if(m.method==="ui/notifications/tool-result"){var r=m.params||{};stack=[];show(r.structuredContent||{kind:"text",text:textOf(r)||"No visual data for this result."})}
 else if(m.method==="ui/notifications/host-context-changed"){theme(m.params)}
 else if(m.method==="ui/resource-teardown"&&m.id!=null){send({id:m.id,result:{}})}
});
if(window.ResizeObserver)new ResizeObserver(size).observe(document.body);
request("ui/initialize",{appInfo:{name:"apprequest-card",version:"1.0.0"},appCapabilities:{},protocolVersion:"2026-01-26"}).then(function(r){if(r)theme(r.hostContext);send({method:"ui/notifications/initialized",params:{}});size()},function(){});
})();
</script></body></html>`;
