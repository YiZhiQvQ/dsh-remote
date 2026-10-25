(()=>{var SPECIAL=new Set(["http:","https:","ws:","wss:","ftp:","file:","data:","blob:","about:","javascript:"]);function parseNonSpecial(input){let m=/^([A-Za-z][A-Za-z0-9+.-]*:)\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/.exec(input);if(m===null)return;let at=m[2].lastIndexOf("@"),host=at===-1?m[2]:m[2].slice(at+1),colon=host.startsWith("[")?-1:host.lastIndexOf(":");return{protocol:m[1].toLowerCase(),hostname:(colon===-1?host:host.slice(0,colon)).toLowerCase(),port:colon===-1?"":host.slice(colon+1),pathname:m[3]||"/",search:m[4]||"",hash:m[5]||""}}function needsRepair(parsed,input){try{return SPECIAL.has(String(parsed.protocol).toLowerCase())||parsed.hostname!==""?!1:parseNonSpecial(input)!==void 0}catch{return!1}}function installUrlCompat(scope){let target=scope??(typeof globalThis>"u"?void 0:globalThis),Native=target&&target.URL;if(typeof Native!="function")return{applied:!1};let sample="dsh-resource://file/probe",broken;try{broken=needsRepair(new Native(sample),sample)}catch{broken=!0}if(!broken)return{applied:!1};function Patched(input,base){let native=base===void 0?new Native(input):new Native(input,base),fixed=needsRepair(native,String(input))?parseNonSpecial(String(input)):void 0;if(fixed===void 0)return native;let out={};return Object.assign(out,{protocol:fixed.protocol,hostname:fixed.hostname,host:fixed.hostname+(fixed.port===""?"":":"+fixed.port),port:fixed.port,pathname:fixed.pathname,search:fixed.search,hash:fixed.hash,href:String(input)}),out}try{Object.setPrototypeOf(Patched,Native),Patched.prototype=Native.prototype;for(let key of Object.getOwnPropertyNames(Native))if(!(key==="prototype"||key==="length"||key==="name"))try{Object.defineProperty(Patched,key,Object.getOwnPropertyDescriptor(Native,key))}catch{}return target.URL=Patched,{applied:!0}}catch{return{applied:!1}}}var panel_default=`.dshr-panel{display:flex;flex-direction:column;gap:16px;padding:24px;max-width:980px;margin:0 auto;color:var(--dsw-alias-label-primary);box-sizing:border-box;height:100%;max-height:100vh;max-height:100dvh;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;}
.dshr-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;}
.dshr-title{margin:0;font-size:20px;line-height:28px;font-weight:600;}
.dshr-desc{margin:6px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);max-width:620px;}
.dshr-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;}
.dshr-spread{justify-content:space-between;align-items:flex-start;}
.dshr-stack{display:flex;flex-direction:column;gap:12px;min-width:0;}
.dshr-grid{display:grid;grid-template-columns:minmax(280px,1fr) minmax(240px,1fr);gap:16px;align-items:start;}
.dshr-card{display:flex;flex-direction:column;gap:12px;padding:16px;border:.5px solid var(--dsw-alias-border-l2);border-radius:16px;background:var(--dsw-alias-bg-layer-2);min-width:0;}
.dshr-sectionTitle{margin:0;font-size:15px;line-height:22px;font-weight:600;}
.dshr-status{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);}
.dshr-status.dshr-ok{color:var(--dsw-alias-state-success-primary);}
.dshr-status.dshr-bad{color:var(--dsw-alias-state-error-primary);}
.dshr-status.dshr-wait{color:var(--dsw-alias-label-secondary);}
.dshr-status.dshr-wait .dshr-dot{animation:dshr-pulse 1s ease-in-out infinite;}
@keyframes dshr-pulse{0%,100%{opacity:.35;}50%{opacity:1;}}
@media (prefers-reduced-motion:reduce){.dshr-status.dshr-wait .dshr-dot{animation:none;opacity:.6;}}
.dshr-dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex:none;}
.dshr-qr{width:200px;height:200px;align-self:center;background:#fff;border-radius:12px;padding:8px;box-sizing:border-box;}
.dshr-url{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);word-break:break-all;min-height:32px;}
.dshr-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 14px;border:.5px solid var(--dsw-alias-border-l3);border-radius:16px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;cursor:pointer;text-decoration:none;box-sizing:border-box;}
.dshr-btn:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dshr-btn:disabled{opacity:.5;cursor:not-allowed;}
.dshr-btn.dshr-primary{border-color:transparent;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);}
.dshr-btn.dshr-primary:hover{background:var(--dsw-alias-button-primary-hover);}
.dshr-note{padding:12px 14px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;}
.dshr-security{padding:12px 14px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-warn-label);font-size:12px;line-height:18px;}
.dshr-warning{padding:10px 14px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-warn-label);font-size:12px;line-height:18px;overflow-wrap:anywhere;}
.dshr-loading{padding:32px;color:var(--dsw-alias-label-secondary);font-size:13px;}
.dshr-error{padding:12px 14px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;overflow-wrap:anywhere;}
.dshr-small{font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary);}
.dshr-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);font-weight:500;}
.dshr-download{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none;}
.dshr-download:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}
.dshr-panelGlyph{display:inline-flex;align-items:center;justify-content:center;flex:none;}
.dshr-uploadToast{position:fixed;right:16px;bottom:16px;z-index:80;max-width:min(420px,calc(100vw - 32px));padding:10px 14px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;box-shadow:0 8px 28px rgba(0,0,0,.28);overflow-wrap:anywhere;}
.dshr-uploadToastError{color:var(--dsw-alias-state-error-primary);}
html.dshr-file-drop [data-files-path]{outline:1px dashed var(--dsw-alias-brand-primary);outline-offset:-2px;}
@media (max-width:680px){.dshr-panel{padding:16px;gap:14px;}.dshr-grid{grid-template-columns:1fr;}.dshr-header{flex-direction:column;align-items:stretch;}}`;var mobile_default=`html.dshm-mobile{--dshm-nav-h:50px;--dshm-safe-top:env(safe-area-inset-top,0px);--dshm-safe-bottom:env(safe-area-inset-bottom,0px);}
html.dshm-mobile body{--dsh-content-font-size:15px!important;--dsh-content-font-delta:1px!important;--dsh-content-font-size-secondary:13px!important;--dsh-content-font-delta-secondary:1px!important;-webkit-text-size-adjust:100%;overscroll-behavior-y:none;}
html.dshm-mobile #root{height:100%;}
html.dshm-mobile .dshm-frame{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr) auto!important;height:var(--dshm-vv-height,100dvh)!important;padding-top:0!important;background:var(--dsw-alias-bg-base)!important;}
html.dshm-mobile.dshm-keyboard{--dshm-nav-h:0px;}
html.dshm-mobile.dshm-keyboard .dshr-nav{display:none!important;}
html.dshm-mobile.dshm-keyboard [data-rightbar-col]{inset:0!important;}
html.dshm-mobile .dshm-frame::before{display:none!important;}
html.dshm-mobile [class*="_centerCol"]{grid-area:1/1!important;min-width:0!important;min-height:0!important;}
html.dshm-mobile [data-shell-bottom]{grid-row:2!important;grid-column:1!important;min-height:0!important;}
html.dshm-mobile [class*="_sidebarCol"]{position:fixed!important;top:0!important;bottom:0!important;left:0!important;right:auto!important;width:min(88vw,340px)!important;max-width:340px!important;z-index:70!important;transform:translateX(-104%);transition:transform .24s cubic-bezier(.2,.8,.2,1);background:var(--dsw-specific-sidebar-fill)!important;border-right:.5px solid var(--dsw-alias-border-l2)!important;box-shadow:0 18px 60px rgba(0,0,0,.42);padding-top:var(--dshm-safe-top);padding-bottom:var(--dshm-safe-bottom);will-change:transform;}
html.dshm-mobile [class*="_sidebarCol"]>*{height:100%;}
html.dshm-mobile.dshm-sidebar-open [class*="_sidebarCol"]{transform:none;}
html.dshm-mobile.dshm-sidebar-open body{overflow:hidden;}
html.dshm-mobile.dshm-sidebar-open .dshm-frame::after{content:"";position:fixed;inset:0;z-index:66;background:rgba(0,0,0,.42);}
html.dshm-mobile [class*="_sidebarCol"]{--dsh-sidebar-inline-padding:10px;}
html.dshm-mobile [class*="_sidebarCol"] [class*="_logoRow"]{height:48px!important;margin-bottom:0!important;}
html.dshm-mobile [class*="_sidebarCol"] [class*="_brandName"]{font-size:16px!important;}
html.dshm-mobile [class*="_sidebarCol"] button[class*="_newSession"]{height:42px!important;font-size:14px!important;border-radius:10px!important;margin-bottom:8px!important;}
html.dshm-mobile.dshm-sidebar-open [role=tooltip],html.dshm-mobile.dshm-sidebar-open [data-radix-tooltip-content]{display:none!important;}
html.dshm-mobile.dshm-sidebar-open [class*="_tooltip"]{display:none!important;}
html.dshm-mobile.dshm-sidebar-open header:has([data-conversation-header-leading]){z-index:60!important;}
html.dshm-mobile.dshm-right-open header:has([data-conversation-header-leading]){z-index:60!important;}
html.dshm-mobile [class*="_sidebarCol"] button[class*="_newSession"]{margin-top:4px!important;}
html.dshm-mobile [class*="_sidebarCol"] [class*="_panelRow"]{min-height:40px!important;font-size:14px!important;border-radius:9px!important;}
html.dshm-mobile [class*="_sidebarCol"] [data-row-key]{min-height:44px!important;padding-top:6px!important;padding-bottom:6px!important;border-radius:9px;}
html.dshm-mobile [class*="_sidebarCol"] [data-row-key] [class*="_title"]{font-size:14px!important;line-height:19px!important;}
html.dshm-mobile [class*="_sidebarCol"] [class*="_sessionRow"]{min-height:44px!important;padding-top:6px!important;padding-bottom:6px!important;}
html.dshm-mobile [class*="_sidebarCol"] button{font-size:14px;}
html.dshm-mobile [class*="_sidebarCol"] [class*="_iconButton"]{width:38px!important;height:38px!important;}
html.dshm-mobile [class*="_sidebarCol"] [class*="_footArea"]{padding-bottom:4px;}
html.dshm-mobile [class*="_sidebarCol"] [class*="_panelList"]{display:none!important;}
html.dshm-mobile [class*="_sidebarCol"] [class*="_regionArea"]{margin-right:0!important;padding-right:6px!important;}
html.dshm-mobile [class*="_sectionHeader"]{position:relative!important;display:flex!important;align-items:center!important;padding-right:112px!important;}
html.dshm-mobile [class*="_sectionHeader"] [class*="_sectionLabel"]{flex:0 0 auto!important;width:auto!important;min-width:0!important;overflow:visible!important;text-overflow:clip!important;white-space:nowrap!important;}
html.dshm-mobile [class*="_sectionHeader"] [class*="_searchSlot"]{position:absolute!important;right:90px!important;left:auto!important;top:50%!important;transform:translateY(-50%)!important;width:auto!important;min-width:28px!important;margin:0!important;z-index:5!important;}
html.dshm-mobile [class*="_sectionHeader"] [class*="_searchSlot"] input{width:100%!important;min-width:0!important;}
html.dshm-mobile [class*="_sectionHeader"]:has(input:focus) [class*="_searchSlot"]{width:calc(100% - 132px)!important;min-width:0!important;}
html.dshm-mobile [class*="_sectionHeader"] [class*="_searchButton"]{width:28px!important;height:28px!important;}
html.dshm-mobile [class*="_sectionHeader"] [class*="_headerActions"]{position:absolute!important;right:4px!important;top:50%!important;transform:translateY(-50%)!important;display:flex!important;align-items:center!important;gap:2px!important;margin:0!important;width:78px!important;min-width:78px!important;max-width:78px!important;overflow:visible!important;flex-wrap:nowrap!important;}
html.dshm-mobile [class*="_sectionHeader"] [class*="_headerActions"]>*{flex:0 0 auto!important;}
html.dshm-mobile [class*="_sectionHeader"] [class*="_headerActions"]>span[class*="_root"]{width:38px!important;min-width:38px!important;max-width:38px!important;}
html.dshm-mobile [class*="_sectionHeader"] button[aria-label="添加工作区"]{position:absolute!important;right:0!important;top:50%!important;transform:translateY(-50%)!important;margin:0!important;}
html.dshm-mobile [class*="_sessionRow"]{display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;grid-template-areas:"slot title actions" "slot time actions"!important;column-gap:6px!important;align-items:center!important;min-height:44px!important;padding:5px 8px!important;}
html.dshm-mobile [class*="_sessionRow"] [class*="_slot"]{grid-area:slot!important;align-self:center!important;}
html.dshm-mobile [class*="_sessionRow"] [class*="_title"]{grid-area:title!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:14px!important;line-height:18px!important;}
html.dshm-mobile [class*="_sessionRow"] [class*="_time"]{grid-area:time!important;margin:0!important;font-size:10.5px!important;line-height:12px!important;color:var(--dsw-alias-label-tertiary)!important;white-space:nowrap!important;}
html.dshm-mobile [class*="_sessionRow"] [class*="_rowActions"]{grid-area:actions!important;display:flex!important;align-items:center!important;gap:2px!important;width:auto!important;opacity:1!important;visibility:visible!important;margin:0!important;}
html.dshm-mobile [class*="_sessionRow"] [class*="_rowActions"] > *{display:flex!important;align-items:center!important;}
html.dshm-mobile [class*="_sessionRow"] [class*="_rowActions"] button{width:26px!important;height:26px!important;min-width:26px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:7px!important;background:transparent!important;color:var(--dsw-alias-label-secondary)!important;}
html.dshm-mobile [class*="_sessionRow"] [class*="_rowActions"] button svg{width:14px!important;height:14px!important;}
html.dshm-mobile header [data-slot="conversation.session.header.utilities"] [class*="WgQWqa_split"]{display:none!important;}
/* DSH's own menu surfaces are opaque; only the mobile layer ever forced a
 * background here, and it named a token the theme does not define
 * (--dsw-alias-bg-elevated), so the literal fallback won. That made every menu
 * — including the background-jobs popover — paint an unrelated grey over
 * whatever DSH had chosen, and the 1px border added a hairline DSH never draws.
 * The popover's own surface already carries the elevation, so leave it alone:
 * only the layout properties the phone actually needs are forced. */
html.dshm-mobile [role=menu]{z-index:1200!important;min-width:190px!important;backdrop-filter:none!important;}
html.dshm-mobile [role=menu] [class*="_itemLabel"]{width:auto!important;min-width:96px!important;max-width:none!important;flex:1 1 auto!important;overflow:visible!important;white-space:nowrap!important;display:block!important;}
html.dshm-mobile [role=menu] [class*="_item_"]{display:flex!important;align-items:center!important;gap:8px!important;min-width:0!important;}
html.dshm-mobile [role=menu][class*="_alignEnd"]{transform:translateY(26px)!important;}
html.dshm-mobile [class*="_sidebarCol"] [class*="_root"]{width:100%!important;max-width:100%!important;}
html.dshm-mobile .dshr-download{width:32px!important;height:32px!important;}
html.dshm-mobile [data-rightbar-col]{position:fixed!important;inset:0 0 calc(var(--dshm-nav-h) + var(--dshm-safe-bottom)) 0!important;width:auto!important;max-width:none!important;z-index:80!important;pointer-events:none!important;display:none;}
html.dshm-mobile.dshm-right-open [data-rightbar-col]{display:block!important;}
html.dshm-mobile [data-sidebar-right-panel]{width:100vw!important;max-width:100vw!important;padding-top:calc(var(--dshm-safe-top) + 4px)!important;padding-bottom:0!important;background:var(--dsw-alias-bg-base)!important;}
html.dshm-mobile [data-sidebar-right-panel] [data-dockkit-host=dock]{transform:none!important;}
html.dshm-mobile [data-sidebar-right-panel] [data-dockkit-tab],html.dshm-mobile [data-sidebar-right-panel] [role=tab]{min-height:36px!important;font-size:13px!important;}
html.dshm-mobile [data-sidebar-right-panel] [data-dockkit-pane],html.dshm-mobile [data-sidebar-right-panel] [data-dockkit-float]{border-radius:0!important;}
html.dshm-mobile [data-sidebar-right-mode]{display:none!important;}
html.dshm-mobile [data-sidebar-right-panel] [data-dockkit-split-button]{display:none!important;}
html.dshm-mobile [data-sidebar-right-panel] [data-files-path]:not([data-files-path="true"]){min-height:0!important;padding:0!important;border-radius:0!important;line-height:normal!important;}
html.dshm-mobile [data-sidebar-right-panel] [data-files-path]:not([data-files-path="true"]) > button{min-height:40px!important;padding:3px 10px!important;border-radius:8px!important;}
html.dshm-mobile [data-sidebar-right-panel] [data-files-path]:not([data-files-path="true"]) *{font-size:14.5px!important;line-height:20px!important;}
html.dshm-mobile [data-sidebar-right-panel] [data-files-path="true"]{min-height:32px!important;font-size:12.5px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;min-width:0!important;}
html.dshm-mobile [data-sidebar-right-panel] button[aria-label*="refresh" i],html.dshm-mobile [data-sidebar-right-panel] button[title*="refresh" i]{width:40px!important;height:40px!important;}
html.dshm-mobile header:has([data-conversation-header-leading]){min-height:0!important;position:relative!important;z-index:1000!important;overflow:visible!important;padding:calc(2px + var(--dshm-safe-top)) 4px 2px 2px!important;grid-template-columns:auto minmax(0,1fr)!important;gap:2px!important;background:color-mix(in srgb,var(--dsw-alias-bg-base) 86%,transparent)!important;backdrop-filter:blur(14px);border-bottom:.5px solid var(--dsw-alias-border-l2)!important;}
html.dshm-mobile header [data-slot="conversation.session.header.actions"] [class*="b06baG_label"]{display:none!important;}
html.dshm-mobile header:has([data-conversation-header-leading]) [data-conversation-header-leading]{gap:2px!important;}
html.dshm-mobile header:has([data-conversation-header-leading]) [data-conversation-header-leading] button{width:38px!important;height:38px!important;min-width:38px!important;border-radius:10px!important;}
html.dshm-mobile header:has([data-conversation-header-leading]) [data-conversation-header-leading] svg{width:18px!important;height:18px!important;}
html.dshm-mobile header:has([data-conversation-header-leading]) [class*="_titleRow"]{min-height:32px!important;padding-inline-start:0!important;}
html.dshm-mobile header:has([data-conversation-header-leading]) [class*="_titleCluster"]{gap:6px!important;}
html.dshm-mobile header:has([data-conversation-header-leading]) button[class*="_crumb"],html.dshm-mobile header:has([data-conversation-header-leading]) [class*="_crumbCurrent"]{max-width:calc(100vw - 124px)!important;font-size:14.5px!important;line-height:19px!important;padding:2px 4px!important;}
html.dshm-mobile header:has([data-conversation-header-leading]) button[class*="_crumb"]:not([class*="_crumbCurrent"]){display:none!important;}
html.dshm-mobile header:has([data-conversation-header-leading]) [class*="_crumbSep"]{display:none!important;}
html.dshm-mobile header:has([data-conversation-header-leading]) [class*="_headerActions"],html.dshm-mobile header:has([data-conversation-header-leading]) [class*="_headerUtilities"]{gap:2px!important;margin-left:4px!important;}
html.dshm-mobile header:has([data-conversation-header-leading]) [class*="_headerActions"] button,html.dshm-mobile header:has([data-conversation-header-leading]) [class*="_headerUtilities"] button{width:38px!important;height:38px!important;min-width:38px!important;}
html.dshm-mobile header:has([data-conversation-header-leading]) [class*="_headerCorner"]{margin-right:0!important;margin-left:2px!important;}
html.dshm-mobile header:has([data-conversation-header-leading]) [class*="_tabs"]{gap:14px!important;margin-top:0!important;padding-left:2px!important;overflow-x:auto;scrollbar-width:none;}
html.dshm-mobile header:has([data-conversation-header-leading]) [class*="_tabs"]::-webkit-scrollbar{display:none;}
html.dshm-mobile header:has([data-conversation-header-leading]) button[class*="_tab"]{font-size:13px!important;padding-bottom:4px!important;white-space:nowrap;}
html.dshm-mobile [data-content-phase=hero] [class*="_titleGroup"]{font-size:22px!important;line-height:28px!important;}
html.dshm-mobile [data-content-phase=hero] [data-composer-input]{min-height:44px!important;}
html.dshm-mobile [data-content-phase=hero] [data-composer-placeholder]{font-size:14.5px!important;line-height:20px!important;}
html.dshm-mobile [data-conversation-region=chat]{--dsh-chat-content-width:100%!important;--dsh-chat-user-width:100%!important;--dsh-composer-card-max-width:100%!important;--dsh-composer-side-clearance:max(8px,env(safe-area-inset-left),env(safe-area-inset-right))!important;--dsh-composer-dock-inset:2px!important;}
html.dshm-mobile [data-conversation-scroll]{scrollbar-gutter:auto!important;}
html.dshm-mobile [data-conversation-scroll] [class*="_scroll"]:has([data-chat-flow]){padding:8px 8px 2px!important;}
html.dshm-mobile [data-conversation-scroll] [class*="_column"]{max-width:100%!important;}
html.dshm-mobile [data-conversation-scroll] [class*="_body"]{gap:11px!important;font-size:15px!important;line-height:23px!important;}
html.dshm-mobile [data-slot="conversation.chat.flow"] > *{margin-top:6px!important;}
html.dshm-mobile [data-composer-card] [class*="_add"] svg{width:16px!important;height:16px!important;}
html.dshm-mobile [data-composer-card] [class*="_primary"] svg{width:16px!important;height:16px!important;}
html.dshm-mobile [data-composer-card] [class*="_standardControls"] svg{width:14px!important;height:14px!important;}
html.dshm-mobile [data-composer-card] [class*="_trailing"] svg{width:15px!important;height:15px!important;}
html.dshm-mobile.dshm-switching [class*="_centerCol"]{visibility:hidden!important;}
html.dshm-mobile header [data-slot="conversation.session.header.actions"]{display:flex!important;align-items:center!important;gap:4px!important;flex-wrap:nowrap!important;min-width:0!important;max-width:55vw!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important;}
html.dshm-mobile header [data-slot="conversation.session.header.actions"]::-webkit-scrollbar{display:none!important;}
html.dshm-mobile header [data-slot="conversation.session.header.actions"] > *{flex:0 0 auto!important;min-width:0!important;}
html.dshm-mobile header [data-slot="conversation.session.header.actions"] button{width:auto!important;height:28px!important;max-width:130px!important;min-width:0!important;padding:0 6px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
html.dshm-mobile header [data-slot="conversation.session.header.actions"] button[class*="_trigger"],html.dshm-mobile header [data-slot="conversation.session.header.actions"] button[class*="oXE0lW"]{min-width:96px!important;}
html.dshm-mobile header [data-slot="conversation.session.header.actions"] span{white-space:nowrap!important;}
html.dshm-mobile header [data-slot="conversation.session.header.actions"] *{white-space:nowrap!important;word-break:keep-all!important;overflow-wrap:normal!important;}
html.dshm-mobile header [class*="_titleCluster"]{min-width:0!important;flex:1 1 auto!important;}
html.dshm-mobile header [class*="_crumbs"]{min-width:0!important;flex:1 1 auto!important;overflow:hidden!important;}
html.dshm-mobile [class*="_widthHandle"],html.dshm-mobile [data-width-handle],html.dshm-mobile [data-side=sidebar][class*="_handle"],html.dshm-mobile [data-side=rightbar][class*="_handle"]{display:none!important;}
html.dshm-mobile [class*="_userRow"]{gap:4px!important;}
html.dshm-mobile [class*="_userStack"]{max-width:90%!important;gap:5px!important;}
html.dshm-mobile [class*="_bubble"]{font-size:14.5px!important;line-height:21px!important;padding:8px 12px!important;border-radius:17px!important;}
html.dshm-mobile [class*="_fileCard"]{flex:0 0 210px!important;width:210px!important;min-height:60px!important;}
html.dshm-mobile [class*="_body"] h1{font-size:22px!important;line-height:30px!important;}
html.dshm-mobile [class*="_body"] h2{font-size:19px!important;line-height:27px!important;}
html.dshm-mobile [class*="_body"] h3{font-size:17px!important;line-height:25px!important;}
html.dshm-mobile [class*="_body"] pre{font-size:12.5px!important;line-height:19px!important;border-radius:11px!important;}
html.dshm-mobile [class*="_body"] table{display:block;max-width:100%;overflow-x:auto;}
html.dshm-mobile [data-conversation-scroll] button[class*="_title"]{min-height:38px;}
html.dshm-mobile [data-conversation-scroll] [class*="_actions"] button{width:38px!important;height:38px!important;}
html.dshm-mobile [data-composer-seat]{--dsh-composer-text-max-height:30vh!important;padding-bottom:0!important;}
html.dshm-mobile [data-composer-card]{border-radius:18px!important;gap:4px!important;padding-top:3px!important;box-shadow:0 6px 24px rgba(0,0,0,.16)!important;}
html.dshm-mobile [data-composer-input]{font-size:15.5px!important;line-height:22px!important;min-height:38px!important;padding:7px 8px 0 13px!important;}
html.dshm-mobile [data-composer-placeholder]{font-size:15.5px!important;line-height:22px!important;inset:7px 8px auto 13px!important;}
html.dshm-mobile [data-composer-card] > [class*="_row"]{padding:1px 6px 3px!important;gap:6px!important;}
html.dshm-mobile [data-composer-card] [class*="_primary"]{width:38px!important;height:38px!important;transform:none!important;}
html.dshm-mobile [data-composer-card] [class*="_primary"] svg{width:18px!important;height:18px!important;}
html.dshm-mobile [data-composer-card] [class*="_add"]{width:34px!important;height:34px!important;}
html.dshm-mobile [data-composer-card] [class*="_select"]{height:30px!important;font-size:12.5px!important;}
html.dshm-mobile [data-composer-dock]{display:none!important;}
html.dshm-mobile [data-composer-dock]::-webkit-scrollbar{display:none;}
html.dshm-mobile [data-composer-dock]>*{flex:none;}
html.dshm-mobile [data-composer-dock] [data-composer-stat="activity"]{display:none!important;}
html.dshm-mobile [data-composer-dock] [data-composer-stat]{flex:none!important;}
html.dshm-mobile [data-composer-dock] [data-composer-stat] [class*="_label"]{overflow:visible!important;text-overflow:clip!important;white-space:nowrap!important;}
.dshr-nav{display:flex;align-items:stretch;height:calc(var(--dshm-nav-h) + var(--dshm-safe-bottom));padding:0 4px var(--dshm-safe-bottom);box-sizing:border-box;background:var(--dsw-alias-bg-layer-1);background:color-mix(in srgb,var(--dsw-alias-bg-base) 88%,transparent);backdrop-filter:blur(18px);border-top:.5px solid var(--dsw-alias-border-l2);}
.dshr-navItem{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;margin:3px 3px;border:0;border-radius:12px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:9.5px;line-height:11px;cursor:pointer;padding:3px 0 2px;-webkit-tap-highlight-color:transparent;}
.dshr-navItem svg{width:20px;height:20px;flex:none;}
.dshr-navItem.dshr-navActive{color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover);}
.dshr-navItem:active{transform:scale(.96);}
html.dshm-mobile .dshr-nav{padding-left:max(4px,env(safe-area-inset-left));padding-right:max(4px,env(safe-area-inset-right));}
html.dshm-mobile header:has([data-conversation-header-leading]){padding-left:calc(4px + env(safe-area-inset-left))!important;padding-right:calc(6px + env(safe-area-inset-right))!important;}
html.dshm-mobile [class*="_sidebarCol"]{padding-left:env(safe-area-inset-left);}
html.dshm-mobile .dshr-panel{padding:calc(12px + var(--dshm-safe-top)) 12px 16px!important;gap:12px!important;max-width:none!important;}
html.dshm-mobile .dshr-title{font-size:20px!important;line-height:28px!important;}
html.dshm-mobile .dshr-grid{grid-template-columns:1fr!important;}
html.dshm-mobile .dshr-card{padding:12px!important;border-radius:16px!important;}
/* Destinations as bare rows: the card box and its heading are gone, so the
 * list reads as a plain menu under the title. Row count is open-ended. */
html.dshm-mobile .dshr-tools{display:flex;flex-direction:column;padding:0!important;gap:0!important;}
html.dshm-mobile .dshr-tool{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:48px;padding:0 2px;border:0;border-top:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:20px;cursor:pointer;text-align:left;-webkit-tap-highlight-color:transparent;}
html.dshm-mobile .dshr-tool:first-of-type{border-top:0;}
html.dshm-mobile .dshr-toolChevron{color:var(--dsw-alias-label-tertiary);font-size:20px;line-height:1;}
html.dshm-mobile .dshr-btn{height:38px!important;padding:0 14px!important;border-radius:19px!important;font-size:13.5px!important;}
html.dshm-mobile .dshr-qr{width:min(190px,64vw)!important;height:auto!important;aspect-ratio:1;}
html.dshr-remote [data-open-target],html.dshr-remote [data-open-target-skeleton]{display:none!important;}
@media (min-width:700px){html.dshm-mobile [data-composer-card]{max-width:720px!important;}html.dshm-mobile [data-conversation-scroll] [class*="_column"]{max-width:760px!important;margin-left:auto!important;margin-right:auto!important;}html.dshm-mobile .dshr-panel{max-width:760px!important;margin-left:auto!important;margin-right:auto!important;}}
@media (max-width:360px){html.dshm-mobile header:has([data-conversation-header-leading]) [class*="_titleCluster"] [class*="_chip"],html.dshm-mobile header [class*="_headerActions"] [class*="b06baG_label"]{display:none!important;}}
@media (max-height:560px){html.dshm-mobile{--dshm-nav-h:46px;}html.dshm-mobile header:has([data-conversation-header-leading]){padding-top:3px!important;padding-bottom:3px!important;}html.dshm-mobile [data-composer-seat]{--dsh-composer-text-max-height:24vh!important;}html.dshm-mobile [data-composer-card]{gap:4px!important;padding-top:3px!important;}html.dshm-mobile [data-composer-input]{min-height:36px!important;padding-top:6px!important;}html.dshm-mobile [class*="_logoRow"]{height:40px!important;}}
@media (prefers-reduced-motion:reduce){html.dshm-mobile [class*="_sidebarCol"],.dshr-navItem{transition:none!important;}}

/* Settings surface.
 *
 * DSH renders settings as a fixed 800px panel beside a 188px left rail. On a
 * 390px phone the panel is clamped to calc(100vw - 48px) = 342px, so the content
 * column keeps only ~154px and every card collapses to one character per line.
 * Stack the rail above the content and let it scroll sideways as a tab strip.
 */
html.dshm-mobile .wCInkW_overlay{align-items:stretch!important;justify-content:stretch!important;}
html.dshm-mobile .wCInkW_panel{width:100vw!important;max-width:100vw!important;height:calc(100dvh - var(--dshm-nav-h) - var(--dshm-safe-bottom))!important;max-height:none!important;flex-direction:column!important;border-radius:0!important;padding-top:var(--dshm-safe-top)!important;overflow:hidden!important;}
html.dshm-mobile .wCInkW_nav{width:100%!important;max-width:100%!important;flex:none!important;flex-direction:column!important;gap:6px!important;padding:10px 12px 6px!important;border-bottom:.5px solid var(--dsw-alias-border-l2)!important;}
html.dshm-mobile .wCInkW_navTitle{font-size:17px!important;line-height:24px!important;padding:0 4px!important;}
html.dshm-mobile .wCInkW_navList{flex-direction:row!important;overflow-x:auto!important;overflow-y:hidden!important;gap:6px!important;padding-bottom:4px!important;scrollbar-width:none;}
html.dshm-mobile .wCInkW_navList::-webkit-scrollbar{display:none!important;}
html.dshm-mobile .wCInkW_navLi{flex:0 0 auto!important;}
html.dshm-mobile .wCInkW_navCell{height:38px!important;padding:0 12px!important;border-radius:10px!important;white-space:nowrap!important;font-size:13.5px!important;}
html.dshm-mobile .wCInkW_navLabel{flex:none!important;overflow:visible!important;text-overflow:clip!important;}
html.dshm-mobile .wCInkW_content{flex:1 1 auto!important;min-height:0!important;width:100%!important;}
html.dshm-mobile .wCInkW_header{height:auto!important;padding:8px 10px 6px!important;align-items:center!important;}

/* Blank/new-session header: the drawer toggle is the only control, so put it
   on the right. Conversation headers keep it on the left next to the title. */
html.dshm-mobile header[class*="headerBlank"]:has([data-conversation-header-leading]),
html.dshm-mobile header[class*="headerSessionless"]:has([data-conversation-header-leading]){grid-template-columns:minmax(0,1fr) auto!important;}
/* The blank session's header slot can carry a min-content width from the title
   row; without this it pushes the auto column past the viewport and the toggle
   is only tappable at the screen edge. */
html.dshm-mobile header[class*="headerBlank"] > *:not([data-conversation-header-leading]),
html.dshm-mobile header[class*="headerSessionless"] > *:not([data-conversation-header-leading]){min-width:0!important;max-width:100%!important;overflow:hidden!important;}
html.dshm-mobile header[class*="headerBlank"] [data-conversation-header-leading],
html.dshm-mobile header[class*="headerSessionless"] [data-conversation-header-leading]{grid-column:2!important;grid-row:1!important;justify-self:end!important;position:relative!important;z-index:2!important;}
`;var picker_default=`/* The remote directory dialog. Kept out of panel.css because it only mounts
   on a LAN page, and out of mobile.css because the desktop browser can be
   narrow too. Colours are DSH theme tokens so the dialog follows light/dark. */

.dshr-picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.5);
  -webkit-tap-highlight-color: transparent;
}

.dshr-picker {
  display: flex;
  flex-direction: column;
  width: min(560px, 100%);
  max-height: min(82vh, 760px);
  overflow: hidden;
  background: var(--dsw-alias-bg-layer-1, #151922);
  color: var(--dsw-alias-label-primary, #f9fafb);
  border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
  border-radius: 14px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
  font-size: 14px;
  line-height: 1.45;
}

.dshr-picker-head,
.dshr-picker-toolbar,
.dshr-picker-crumbs,
.dshr-picker-status,
.dshr-picker-foot {
  flex: 0 0 auto;
}

.dshr-picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 8px;
}

.dshr-picker-title {
  font-size: 15px;
  font-weight: 600;
}

.dshr-picker-close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: var(--dsw-alias-label-secondary, #cfd3d6);
  background: transparent;
  border: 0;
  border-radius: 8px;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.dshr-picker-close:hover {
  color: var(--dsw-alias-label-primary, #f9fafb);
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.06));
}

.dshr-picker-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px 6px;
}

.dshr-picker-drive,
.dshr-picker-path {
  min-width: 0;
  padding: 6px 8px;
  color: var(--dsw-alias-label-primary, #f9fafb);
  background: var(--dsw-alias-bg-base, #0f1115);
  border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
  border-radius: 8px;
  font: inherit;
  font-size: 12px;
}

.dshr-picker-drive {
  flex: 0 0 auto;
  max-width: 84px;
}

.dshr-picker-path {
  flex: 1 1 auto;
}

.dshr-picker-crumbs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  min-height: 28px;
  padding: 0 16px 8px;
  overflow-x: auto;
}

.dshr-picker-crumb {
  max-width: 180px;
  padding: 4px 6px;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary, #cfd3d6);
  background: transparent;
  border: 0;
  border-radius: 6px;
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
}

.dshr-picker-crumb:hover {
  color: var(--dsw-alias-label-primary, #f9fafb);
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.06));
}

.dshr-picker-crumb-current {
  color: var(--dsw-alias-label-primary, #f9fafb);
  font-weight: 600;
}

.dshr-picker-sep {
  color: var(--dsw-alias-label-tertiary, #9aa0a6);
  font-size: 12px;
}

.dshr-picker-list {
  flex: 1 1 auto;
  min-height: 120px;
  padding: 4px 8px 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.dshr-picker-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  overflow: hidden;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 8px;
  font: inherit;
  text-align: left;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
}

.dshr-picker-row::before {
  content: "";
  flex: 0 0 auto;
  width: 14px;
  height: 11px;
  border: 1.5px solid var(--dsw-alias-label-tertiary, #9aa0a6);
  border-radius: 2px;
}

.dshr-picker-row:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.06));
}

.dshr-picker-up::before {
  border-style: dashed;
}

.dshr-picker-hidden {
  opacity: 0.55;
}

.dshr-picker-empty {
  padding: 28px 12px;
  color: var(--dsw-alias-label-tertiary, #9aa0a6);
  text-align: center;
}

.dshr-picker-status {
  min-height: 18px;
  padding: 0 16px 6px;
  color: var(--dsw-alias-label-tertiary, #9aa0a6);
  font-size: 12px;
}

.dshr-picker-error {
  color: var(--dsw-alias-state-error-primary, #f28b82);
}

.dshr-picker-foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 16px 14px;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
}

.dshr-picker-name {
  flex: 1 1 150px;
  min-width: 0;
  padding: 8px 10px;
  color: var(--dsw-alias-label-primary, #f9fafb);
  background: var(--dsw-alias-bg-base, #0f1115);
  border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
  border-radius: 8px;
  font: inherit;
}

.dshr-picker-name::placeholder {
  color: var(--dsw-alias-label-tertiary, #9aa0a6);
}

.dshr-picker-spacer {
  flex: 1 1 0;
}

.dshr-picker-button {
  padding: 8px 12px;
  color: var(--dsw-alias-label-primary, #f9fafb);
  background: var(--dsw-alias-bg-layer-2, #1b2029);
  border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
  border-radius: 8px;
  font: inherit;
  cursor: pointer;
}

.dshr-picker-button:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
}

.dshr-picker-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.dshr-picker-primary {
  color: var(--dsw-alias-label-primary-foreground, #fff);
  background: var(--dsw-alias-button-primary-fill, #4d6bfe);
  border-color: var(--dsw-alias-button-primary-fill, #4d6bfe);
}

.dshr-picker-primary:hover {
  background: var(--dsw-alias-button-primary-hover, #3f5ce8);
}

/* Host-side "open with" launches on the PC. On a LAN page it is a dead end;
   the download action in the preview header is the remote equivalent. */
.dshr-remote [data-open-target],
.dshr-remote [data-open-path-open],
.dshr-remote [data-open-path-unpreviewable],
.dshr-remote [data-open-path-more] {
  display: none !important;
}

@media (max-width: 640px) {
  .dshr-picker-backdrop {
    align-items: flex-end;
    padding: 0;
  }

  .dshr-picker {
    width: 100%;
    max-height: 88vh;
    border-radius: 14px 14px 0 0;
    border-bottom: 0;
  }
}
`;var account_default=`/* Remote pages: no DeepSeek account sign-in or sign-out.
 *
 * The guard sets an inline display:none on each control — that is what survives
 * a React re-render. This rule is the second handle: it covers the brief moment
 * between a subtree being inserted and the observer's microtask running, and it
 * makes the hidden controls inspectable as [data-dshr-acct-hidden].
 */
html.dshr-remote .dshr-acct-off,
html.dshr-remote [data-dshr-acct-hidden]{display:none!important;}
`;var en_default={meta:{title:"Remote Access",description:"Single-admin LAN access, pairing QR, artifact downloads, and remote file uploads for the DSH desktop Web GUI."},plugin:{panel:"Remote Access",title:"Remote access",desc:"Open this DSH desktop from a phone or tablet on the same LAN. Sign in once with the administrator password, then use the normal DSH interface.",refresh:"Refresh",copy:"Copy link",copied:"Copied",open:"Open",download:"Download",pickerTitle:"Select Workspace Directory",pickerHome:"Home",pickerDrive:"Drive",pickerPath:"Path",pickerUp:"Up",pickerEmpty:"No subdirectories",pickerNewFolder:"New folder",pickerFolderName:"Folder name",pickerCreate:"Create",pickerCancel:"Cancel",pickerSelect:"Select this directory",pickerLoading:"Loading…",pickerError:"Could not read the directory",pickerTruncated:"Too many folders; showing the first 1000.",pickerCreateFailed:"Could not create the folder",uploading:"Uploading",uploaded:"Uploaded",uploadFailed:"Upload failed",fileCount:"file(s)",uploadTo:"to",security:"Security: the administrator password protects this DSH on the LAN. Use a strong password and never share it.",overview:"Overview",pairing:"Pairing",status:"Status",account:"Account",logout:"Sign out",localNoLogout:"This is the local desktop window. Remote sign-out is only available from the LAN page.",proxyOk:"LAN forwarding is reachable",proxyDown:"No listener on the LAN port",dshPort:"DSH port",lanPort:"LAN port",noLan:"No private IPv4 address detected. Connect this PC to the LAN and restart DSH.",pairingUnavailable:"Pairing URL unavailable",qrAlt:"QR code for",loading:"Loading remote access status",error:"Could not load remote access status",defaultPassword:"The default password admin / dsh-remote is in use. Run scripts/set-remote-password.ps1 to change it.",loginUrl:"Login URL",username:"Username",passwordSource:"Password source",sourceDefault:"default",sourceConfig:"config file",sourceFile:"password file",mobileNav:"Mobile navigation",mobileChat:"Chat",mobileSessions:"Sessions",mobileFiles:"Files",mobileMore:"More",mobileNoSession:"Open or create a session first",mobileDrawerHint:"Tap a session to open it",mobilePlugins:"Plugins",mobileSchedules:"Automations",mobileTrash:"Trash",mobileMoreTitle:"More",mobileToggleBlocked:"Close the remote plugin from the desktop window. Disabling it here would drop this connection.",proxyToggleBlocked:"This page is served through the remote proxy. Disabling the plugin would drop this page; open the DSH direct window instead.",switching:"Switching…",starting:"Starting the listener",stopping:"Stopping the listener",pause:"Pause remote access",resume:"Resume remote access",paused:"Remote access is paused.",accountRemoteOnly:"Sign in or out of the DeepSeek account on the computer; refresh this page afterwards.",toggleUsePanel:"Use Pause/Resume in the Remote Access panel. The plugin-manager master switch restarts DSH."}};var zh_default={meta:{title:"远程访问",description:"单管理员局域网访问、配对二维码、产物下载和远程文件上传，直接控制这台电脑上的 DSH。"},plugin:{panel:"远程访问",title:"远程访问",desc:"在同一局域网内用手机或平板打开这台电脑上的 DSH。用管理员密码登录一次，之后直接使用正常的 DSH 界面。",refresh:"刷新",copy:"复制链接",copied:"已复制",open:"打开",download:"下载",pickerTitle:"选择工作区目录",pickerHome:"主目录",pickerDrive:"磁盘",pickerPath:"路径",pickerUp:"上一级",pickerEmpty:"没有子目录",pickerNewFolder:"新建文件夹",pickerFolderName:"文件夹名称",pickerCreate:"创建",pickerCancel:"取消",pickerSelect:"选择此目录",pickerLoading:"加载中…",pickerError:"无法读取目录",pickerTruncated:"文件夹过多，仅显示前 1000 个。",pickerCreateFailed:"创建文件夹失败",uploading:"正在上传",uploaded:"已上传",uploadFailed:"上传失败",fileCount:"个文件",uploadTo:"到",security:"安全提示：管理员密码是这台 DSH 在局域网内的入口。请使用强密码，不要转发给他人。",overview:"概览",pairing:"配对",status:"状态",account:"账号",logout:"退出登录",localNoLogout:"这是本机桌面窗口；远程退出登录只在局域网页面可用。",proxyOk:"局域网转发可达",proxyDown:"LAN 端口没有监听",dshPort:"DSH 端口",lanPort:"LAN 端口",noLan:"没有检测到私有 IPv4 地址。请把电脑接入局域网后重启 DSH。",pairingUnavailable:"配对地址不可用",qrAlt:"二维码：",loading:"正在读取远程访问状态",error:"无法读取远程访问状态",defaultPassword:"当前仍是默认密码 admin / dsh-remote。请运行 scripts/set-remote-password.ps1 修改。",loginUrl:"登录地址",username:"用户名",passwordSource:"密码来源",sourceDefault:"默认密码",sourceConfig:"配置",sourceFile:"密码文件",mobileNav:"手机导航",mobileChat:"对话",mobileSessions:"会话",mobileFiles:"文件",mobileMore:"更多",mobileNoSession:"请先打开或新建一个会话",mobileDrawerHint:"点一个会话即可打开",mobilePlugins:"插件",mobileSchedules:"自动化任务",mobileTrash:"回收站",mobileMoreTitle:"更多",mobileToggleBlocked:"远程页面不能关闭远程访问插件；请在电脑本机操作，否则当前连接会断开。",proxyToggleBlocked:"当前页面通过远程代理打开；关闭插件会断开此页面。请从 DSH 直连窗口操作。",switching:"正在切换…",starting:"正在启动监听",stopping:"正在停止监听",pause:"暂停远程访问",resume:"恢复远程访问",paused:"远程访问已暂停。",accountRemoteOnly:"DeepSeek 账号只在电脑本机登录或退出；手机端请让电脑窗口完成后再刷新。",toggleUsePanel:"请用远程访问面板里的暂停/恢复；插件管理器总开关会重启 DSH。"}};function isDesktopShell(){try{if(globalThis.__DSH_HOST_PATHS__!==void 0&&globalThis.__DSH_HOST_PATHS__!==null)return!0;let ua=typeof navigator<"u"?String(navigator.userAgent||""):"";if(/Electron/i.test(ua))return!0;let proc=typeof process<"u"?process:void 0;if(proc&&proc.versions&&proc.versions.electron||globalThis.__DSH_ELECTRON__===!0||globalThis.__DSH_DESKTOP__===!0)return!0}catch{}return!1}function isRemoteOrigin(){if(isDesktopShell())return!1;try{let host=String(window.location.hostname||"");return host!=="127.0.0.1"&&host!=="localhost"&&host!=="::1"&&host!=="[::1]"&&host.length>0}catch{return!1}}function forcedMobileMode(){try{let value=new URLSearchParams(window.location.search).get("dshm");if(value==="mobile")return!0;if(value==="desktop")return!1}catch{}}function isMobileLayout(){if(isDesktopShell())return!1;let forced=forcedMobileMode();if(forced!==void 0)return forced;if(!isRemoteOrigin())return!1;try{if(typeof window>"u"||typeof window.matchMedia!="function")return!1;let coarse=window.matchMedia("(pointer: coarse)").matches,narrow=window.matchMedia("(max-width: "+String(900)+"px)").matches,tablet=window.matchMedia("(max-width: "+String(1180)+"px)").matches;return coarse&&tablet?!0:narrow}catch{return!1}}function applyMobileViewport(document2){try{let meta=document2.querySelector('meta[name="viewport"]');if(meta===null)return;let view=document2.defaultView,navigator2=view&&view.navigator?view.navigator:void 0,userAgent=navigator2&&typeof navigator2.userAgent=="string"?navigator2.userAgent:"",platform=navigator2&&typeof navigator2.platform=="string"?navigator2.platform:"",touchPoints=navigator2&&typeof navigator2.maxTouchPoints=="number"?navigator2.maxTouchPoints:0,cover=/iPad|iPhone|iPod/.test(userAgent)||platform==="MacIntel"&&touchPoints>1?",viewport-fit=cover":"";meta.setAttribute("content","width=device-width,initial-scale=1"+cover+",interactive-widget=resizes-content")}catch{}}function installViewport(root,window2){let frame=0,sync=()=>{frame=0;try{let viewport=window2.visualViewport;if(!viewport)return;if(!root.classList.contains("dshm-mobile")){root.classList.remove("dshm-keyboard"),root.style.removeProperty("--dshm-vv-height");return}let keyboard=viewport.height<window2.innerHeight-80;root.classList.toggle("dshm-keyboard",keyboard),keyboard?root.style.setProperty("--dshm-vv-height",Math.round(viewport.height)+"px"):root.style.removeProperty("--dshm-vv-height")}catch{}},schedule=()=>{frame===0&&(frame=typeof window2.requestAnimationFrame=="function"?window2.requestAnimationFrame(sync):window2.setTimeout(sync,16))};return window2.visualViewport&&typeof window2.visualViewport.addEventListener=="function"&&(window2.visualViewport.addEventListener("resize",schedule),window2.visualViewport.addEventListener("scroll",schedule)),sync(),()=>{window2.visualViewport&&typeof window2.visualViewport.removeEventListener=="function"&&(window2.visualViewport.removeEventListener("resize",schedule),window2.visualViewport.removeEventListener("scroll",schedule)),frame!==0&&(typeof window2.cancelAnimationFrame=="function"?window2.cancelAnimationFrame(frame):window2.clearTimeout(frame))}}var ANCHORS=[{id:"shellRoot",selector:"[data-shell-bottom]",required:!0,purpose:"the frame row that hosts the bottom navigation"},{id:"shellOverlay",selector:"[data-shell-overlay]",required:!1,purpose:"frame-wide floating layer"},{id:"rightPanelOpen",selector:"[data-sidebar-right-panel][data-sidebar-right-open]",required:!1,purpose:"whether the Files sheet is open"},{id:"rightPanel",selector:"[data-sidebar-right-panel]",required:!1,purpose:"the Files sheet container"},{id:"rightToggle",selector:"[data-sidebar-right-toggle]",required:!1,purpose:"the header button that opens Files"},{id:"composerInput",selector:"[data-composer-input]",required:!1,purpose:"the composer, which must not steal focus under a sheet"},{id:"sessionRow",selector:"[data-row-key]",required:!1,purpose:"a session or workspace row in the drawer"},{id:"filesPath",selector:"[data-files-path]",required:!1,purpose:"a directory row that accepts a drop"},{id:"conversationHeaderLeading",selector:"[data-conversation-header-leading]",required:!1,purpose:"the drawer toggle in the conversation header"},{id:"dockTab",selector:"[data-dockkit-tab]",required:!1,purpose:"the Files tab strip"},{id:"documentTab",selector:'[data-slot="sidebar.right.tab.document"]',required:!1,purpose:"whether a document preview owns the sheet"},{id:"sidebarCol",selector:'[class*="_sidebarCol"]',required:!1,purpose:"the left column, which becomes the drawer"},{id:"centerCol",selector:'[class*="_centerCol"]',required:!1,purpose:"the conversation column"},{id:"sectionHeader",selector:'[class*="_sectionHeader"]',required:!1,purpose:"workspace/session section headers"},{id:"searchSlot",selector:'[class*="_searchSlot"]',required:!1,purpose:"the search field inside a section header"},{id:"sessionRowInner",selector:'[class*="_sessionRow"]',required:!1,purpose:"session row padding"},{id:"rowActions",selector:'[class*="_rowActions"]',required:!1,purpose:"row action cluster that must stay visible on touch"},{id:"newSession",selector:'button[class*="_newSession"]',required:!1,purpose:"the New Session button"},{id:"panelRow",selector:'button[class*="_panelRow"]',required:!1,purpose:"the sidebar panel rows"},{id:"panelList",selector:'[class*="_panelList"]',required:!1,purpose:"the sidebar panel list, hidden on phones"},{id:"regionArea",selector:'[class*="_regionArea"]',required:!1,purpose:"the sidebar scroll region"},{id:"footArea",selector:'[class*="_footArea"]',required:!1,purpose:"the sidebar footer spacing"},{id:"logoRow",selector:'[class*="_logoRow"]',required:!1,purpose:"the sidebar brand row height"},{id:"brandName",selector:'[class*="_brandName"]',required:!1,purpose:"the sidebar brand text size"},{id:"tooltip",selector:'[class*="_tooltip"]',required:!1,purpose:"tooltips that must not float over the drawer"},{id:"headerActions",selector:'[class*="_headerActions"]',required:!1,purpose:"conversation header actions"},{id:"titleCluster",selector:'[class*="_titleCluster"]',required:!1,purpose:"conversation header title cluster"}],BY_ID=new Map(ANCHORS.map(anchor=>[anchor.id,anchor]));function selectorFor(id){let anchor=BY_ID.get(id);if(anchor===void 0)throw new Error('dsh-remote: unknown anchor "'+id+'"');return anchor.selector}var MOUNT_TIMEOUT_MS=2e3;function probe(document2){let missing=[],missingOptional=[];for(let anchor of ANCHORS){let found=!1;try{found=document2.querySelector(anchor.selector)!==null}catch{found=!1}found||(anchor.required?missing.push(anchor.id):missingOptional.push(anchor.id))}return{ok:missing.length===0,missing,missingOptional,ready:!0}}function publish(root,caps){try{if(caps.ok){root.removeAttribute("data-dshm-caps");return}root.setAttribute("data-dshm-caps","missing:"+caps.missing.join(","))}catch{}}function waitForShell(document2,window2,timeoutMs=MOUNT_TIMEOUT_MS){let immediate=probe(document2);return immediate.ok?Promise.resolve(immediate):new Promise(resolve=>{let settled=!1,frame=0,finish=caps=>{settled||(settled=!0,observer!==void 0&&observer.disconnect(),frame!==0&&window2.cancelAnimationFrame(frame),window2.clearTimeout(timer),resolve(caps))},check=()=>{frame=0;let caps=probe(document2);caps.ok&&finish(caps)},schedule=()=>{frame===0&&(frame=window2.requestAnimationFrame(check))},observer=typeof MutationObserver=="function"?new MutationObserver(schedule):void 0;if(observer!==void 0)try{observer.observe(document2.documentElement,{childList:!0,subtree:!0})}catch{}let timer=window2.setTimeout(()=>finish(probe(document2)),timeoutMs);schedule()})}var state={drawerOpen:!1,rightOpen:!1,switching:!1,view:"chat"},listeners=new Set;function publish2(next){let changed=next.drawerOpen!==state.drawerOpen||next.rightOpen!==state.rightOpen||next.switching!==state.switching||next.view!==state.view;if(state.drawerOpen=next.drawerOpen,state.rightOpen=next.rightOpen,state.switching=next.switching,state.view=next.view,!!changed)for(let listener of[...listeners])try{listener(state)}catch{}}function subscribe(listener){return listeners.add(listener),()=>listeners.delete(listener)}function current(){return state}function read(document2,panel,panelId){let drawerOpen2=!1;try{let row=document2.querySelector(selectorFor("shellRoot")),frame=row!==null&&row.parentElement!==null?row.parentElement:null;frame!==null&&(drawerOpen2=!frame.hasAttribute("data-sidebar-collapsed"))}catch{drawerOpen2=!1}let rightOpen=!1;try{rightOpen=document2.querySelector(selectorFor("rightPanelOpen"))!==null}catch{rightOpen=!1}let activePanelId2=panel==null?null:panel.activePanelId,view="chat";return rightOpen?view="files":activePanelId2!=null?view="more":drawerOpen2&&(view="sessions"),publish2({drawerOpen:drawerOpen2,rightOpen,switching:state.switching,view}),state}function applyClasses(document2,value){let root=document2.documentElement;if(root===null||root.classList===void 0)return;let set=(name,on)=>{try{on?root.classList.add(name):root.classList.remove(name)}catch{}};set("dshm-sidebar-open",value.drawerOpen),set("dshm-right-open",value.rightOpen),set("dshm-switching",value.switching),applyFrameClass(document2)}function applyFrameClass(document2){try{let row=document2.querySelector(selectorFor("shellRoot")),frame=row!==null&&row.parentElement!==null?row.parentElement:null;if(frame===null||frame.classList===void 0)return;frame.classList.add("dshm-frame")}catch{}}function resetDrawerScroll(document2,window2){let run=()=>{try{let sidebar=document2.querySelector(selectorFor("sidebarCol"));if(sidebar===null)return;let touched=0;for(let element2 of sidebar.querySelectorAll("*")){if(touched>=20)break;element2.scrollTop>0&&element2.scrollHeight>element2.clientHeight+2&&(element2.scrollTop=0,touched+=1)}}catch{}};typeof window2.requestIdleCallback=="function"?window2.requestIdleCallback(run):window2.setTimeout(run,120)}function installChrome(options){let{document:document2,window:window2,readPanel,panelId,onView}=options,frame=0,lastPublished="",drawerWasOpen=!1,sync=()=>{frame=0;try{if(!document2.documentElement.classList.contains("dshm-mobile"))return}catch{return}let value=read(document2,readPanel(),panelId);applyClasses(document2,value);let justOpened=value.drawerOpen&&!drawerWasOpen;drawerWasOpen=value.drawerOpen,justOpened&&resetDrawerScroll(document2,window2);let key=String(value.drawerOpen)+String(value.rightOpen)+value.view;key!==lastPublished&&(lastPublished=key,onView(value.view))},schedule=()=>{frame===0&&(frame=typeof window2.requestAnimationFrame=="function"?window2.requestAnimationFrame(sync):window2.setTimeout(sync,16))},observer=typeof MutationObserver=="function"?new MutationObserver(schedule):void 0;if(observer!==void 0)try{observer.observe(document2.documentElement,{attributes:!0,subtree:!0,attributeFilter:["data-sidebar-collapsed","data-sidebar-right-open"]})}catch{}return typeof readPanel=="function"&&schedule(),()=>{observer!==void 0&&observer.disconnect(),frame!==0&&(typeof window2.cancelAnimationFrame=="function"?window2.cancelAnimationFrame(frame):window2.clearTimeout(frame)),listeners.clear();try{let row=document2.querySelector(selectorFor("shellRoot")),element2=row!==null&&row.parentElement!==null?row.parentElement:null;element2!==null&&element2.classList!==void 0&&element2.classList.remove("dshm-frame")}catch{}}}function service(ctx,name){try{return ctx&&typeof ctx.get=="function"?ctx.get(name):void 0}catch{return}}function layoutOf(ctx){return service(ctx,"layout")}function sidebarRightOf(ctx){return service(ctx,"sidebarRight")}function activePanelId(ctx){let layout=layoutOf(ctx),panelInfo=layout&&layout.panelInfo;if(!panelInfo||typeof panelInfo.getSnapshot!="function")return null;try{let snapshot=panelInfo.getSnapshot();return snapshot==null?null:snapshot.activePanelId??null}catch{return null}}function selectPanel(ctx,id){let layout=layoutOf(ctx);if(!layout||typeof layout.selectPanel!="function")return!1;try{return layout.selectPanel(id),!0}catch{return!1}}function suppressComposerFocus(ms=700){if(typeof document>"u"||typeof window>"u")return;let onFocus=event=>{let target=event.target;if(target&&typeof target.closest=="function"&&target.closest(selectorFor("composerInput")))try{target.blur()}catch{}};document.addEventListener("focusin",onFocus,!0);let active=document.activeElement;if(active&&typeof active.blur=="function")try{active.blur()}catch{}window.setTimeout(()=>document.removeEventListener("focusin",onFocus,!0),ms)}function drawerOpen(){try{let row=document.querySelector(selectorFor("shellRoot")),container=row!==null&&row.parentElement!==null?row.parentElement:null;return container===null?!1:!container.hasAttribute("data-sidebar-collapsed")}catch{return!1}}function setDrawer(ctx,open){let isOpen=drawerOpen();if(open===isOpen)return;let layout=layoutOf(ctx);layout&&typeof layout.toggleSidebar=="function"&&layout.toggleSidebar()}function setRightPanel(ctx,open){let right=sidebarRightOf(ctx);if(!right)return;let isOpen=!1;try{isOpen=document.querySelector(selectorFor("rightPanelOpen"))!==null}catch{isOpen=!1}open!==isOpen&&typeof right.toggleExpanded=="function"&&right.toggleExpanded()}function openFiles(ctx,timeoutMs=1e3){if(typeof document>"u"||typeof window>"u")return Promise.resolve(!1);let root=document.documentElement;suppressComposerFocus(),activePanelId(ctx)!==null&&(root&&root.classList&&root.classList.add("dshm-switching"),selectPanel(ctx,null));let deadline=Date.now()+timeoutMs;return new Promise(resolve=>{let attempt=()=>{let right=sidebarRightOf(ctx);if(right&&typeof right.openTab=="function")try{right.openTab("files"),root&&root.classList&&window.setTimeout(()=>root.classList.remove("dshm-switching"),80),resolve(!0);return}catch{}if(Date.now()>=deadline){root&&root.classList&&root.classList.remove("dshm-switching"),resolve(!1);return}window.setTimeout(attempt,60)};attempt()})}function createMobileNav(deps){let{h,React,t,ctx,panelId,glyphs,onView}=deps;return function(){let[visible,setVisible]=React.useState(isMobileLayout()),[view,setView]=React.useState(current().view);if(React.useEffect(()=>{let update=()=>setVisible(isMobileLayout());if(update(),typeof window>"u")return;window.addEventListener("resize",update,{passive:!0}),window.addEventListener("orientationchange",update,{passive:!0});let media;if(typeof window.matchMedia=="function")try{media=window.matchMedia("(max-width: 900px)"),media&&typeof media.addEventListener=="function"?media.addEventListener("change",update):media&&typeof media.addListener=="function"&&media.addListener(update)}catch{media=void 0}return()=>{window.removeEventListener("resize",update),window.removeEventListener("orientationchange",update),media&&(typeof media.removeEventListener=="function"?media.removeEventListener("change",update):media&&typeof media.removeListener=="function"&&media.removeListener(update))}},[]),React.useEffect(()=>subscribe(state2=>setView(state2.view)),[]),!visible)return null;let go=next=>{if(next==="chat")setRightPanel(ctx,!1),setDrawer(ctx,!1),selectPanel(ctx,null),onView("chat");else if(next==="sessions"){if(setRightPanel(ctx,!1),drawerOpen()){setDrawer(ctx,!1),onView("chat");return}activePanelId(ctx)!==null?(suppressComposerFocus(),selectPanel(ctx,null),window.setTimeout(()=>setDrawer(ctx,!0),30)):setDrawer(ctx,!0),onView("sessions")}else if(next==="files"){setDrawer(ctx,!1),openFiles(ctx).then(opened=>{onView(opened?"files":"chat")});return}else next==="more"&&(setRightPanel(ctx,!1),setDrawer(ctx,!1),selectPanel(ctx,panelId),onView("more"));setView(next)},items=[{id:"chat",label:t("mobileChat"),icon:glyphs.chat},{id:"sessions",label:t("mobileSessions"),icon:glyphs.sessions},{id:"files",label:t("mobileFiles"),icon:glyphs.files},{id:"more",label:t("mobileMore"),icon:glyphs.more}];return h("nav",{className:"dshr-nav",role:"navigation","aria-label":t("mobileNav")},items.map(item=>h("button",{key:item.id,type:"button",className:"dshr-navItem"+(view===item.id?" dshr-navActive":""),"aria-current":view===item.id?"page":void 0,title:item.label,onClick:()=>go(item.id)},h(item.icon,{size:22}),h("span",null,item.label))))}}function mobileActive(document2){try{let root=document2.documentElement;return root!==null&&root.classList!==void 0&&root.classList.contains("dshm-mobile")}catch{return!1}}function installMobileInteractions(deps){let{document:document2,window:window2,ctx}=deps;if(typeof document2.addEventListener!="function")return()=>{};let retireDrawer=()=>{window2.setTimeout(()=>{setDrawer(ctx,!1),activePanelId(ctx)!==null&&selectPanel(ctx,null)},180)},onPointerDown=event=>{if(!mobileActive(document2))return;let target=event&&event.target;if(!target)return;let root=document2.documentElement,sidebar=null;try{sidebar=document2.querySelector(selectorFor("sidebarCol"))}catch{sidebar=null}sidebar!==null&&typeof sidebar.contains=="function"&&sidebar.contains(target)||root.classList.contains("dshm-sidebar-open")&&(typeof target.closest=="function"&&(target.closest(selectorFor("conversationHeaderLeading"))!==null||target.closest(".dshr-nav")!==null)||setDrawer(ctx,!1))},onClick=event=>{if(!mobileActive(document2))return;let target=event&&event.target;if(!target||typeof target.closest!="function")return;if(target.closest(selectorFor("rightToggle"))!==null&&window2.setTimeout(()=>{document2.querySelector(selectorFor("rightPanelOpen"))!==null&&document2.querySelector(selectorFor("documentTab"))},120),target.closest(selectorFor("newSession"))!==null){retireDrawer();return}let row=target.closest(selectorFor("sessionRow"));if(row===null||!String(row.getAttribute("data-row-key")||"").startsWith("session:"))return;let action=target.closest('[class*="_rowActions"], button');action!==null&&row.contains(action)||retireDrawer()},onKeyDown=event=>{if(!mobileActive(document2)||!event||event.key!=="Escape")return;let root=document2.documentElement;root.classList.contains("dshm-right-open")?setRightPanel(ctx,!1):root.classList.contains("dshm-sidebar-open")&&setDrawer(ctx,!1)};return document2.addEventListener("pointerdown",onPointerDown,!0),document2.addEventListener("click",onClick,!0),document2.addEventListener("keydown",onKeyDown),()=>{document2.removeEventListener("pointerdown",onPointerDown,!0),document2.removeEventListener("click",onClick,!0),document2.removeEventListener("keydown",onKeyDown)}}function createIcons(h){let size=props=>props&&props.size?props.size:16;function DownloadIcon(props){return h("svg",{width:size(props),height:size(props),viewBox:"0 0 16 16",fill:"none","aria-hidden":"true"},h("path",{d:"M8 2v7m0 0 2.5-2.5M8 9 5.5 6.5M3 11.5V13h10v-1.5",stroke:"currentColor",strokeWidth:1.3,strokeLinecap:"round",strokeLinejoin:"round"}))}function PhoneIcon(props){return h("svg",{width:size(props),height:size(props),viewBox:"0 0 16 16",fill:"none","aria-hidden":"true"},h("rect",{x:4,y:1.5,width:8,height:13,rx:1.5,stroke:"currentColor",strokeWidth:1.2}),h("path",{d:"M7 12.5h2",stroke:"currentColor",strokeWidth:1.2,strokeLinecap:"round"}))}function ChatGlyph(){return h("svg",{width:22,height:22,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.7,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true"},h("path",{d:"M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-5 3.5v-3.5H6.5A2.5 2.5 0 0 1 4 13.5z"}))}function SessionsGlyph(){return h("svg",{width:22,height:22,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.7,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true"},h("path",{d:"M8.5 6.5h11M8.5 12h11M8.5 17.5h11"}),h("circle",{cx:4.5,cy:6.5,r:1.15,fill:"currentColor",stroke:"none"}),h("circle",{cx:4.5,cy:12,r:1.15,fill:"currentColor",stroke:"none"}),h("circle",{cx:4.5,cy:17.5,r:1.15,fill:"currentColor",stroke:"none"}))}function FilesGlyph(){return h("svg",{width:22,height:22,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.7,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true"},h("path",{d:"M3.5 7.5A2 2 0 0 1 5.5 5.5h3.2l1.8 2h8A2 2 0 0 1 20.5 9.5v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"}))}function MoreGlyph(){return h("svg",{width:22,height:22,viewBox:"0 0 24 24",fill:"currentColor",stroke:"none","aria-hidden":"true"},h("circle",{cx:6,cy:12,r:1.6}),h("circle",{cx:12,cy:12,r:1.6}),h("circle",{cx:18,cy:12,r:1.6}))}return{DownloadIcon,PhoneIcon,ChatGlyph,SessionsGlyph,FilesGlyph,MoreGlyph,chat:ChatGlyph,sessions:SessionsGlyph,files:FilesGlyph,more:MoreGlyph,RemotePanelIcon(props){return h("span",{className:"dshr-panelGlyph"},h(PhoneIcon,{size:props&&props.size?props.size:16}))}}}function createRemotePanel(deps){let{h,React,t,isMobileLayout:isMobileLayout2}=deps;function fallbackCopy(document2,text){let area=document2.createElement("textarea");area.value=text,area.setAttribute("readonly",""),area.style.position="fixed",area.style.opacity="0",document2.body.appendChild(area),area.select();try{document2.execCommand("copy")}catch{}finally{area.remove()}}async function loadInfo(signal){let response=await fetch("/api/remote/info",{credentials:"same-origin",cache:"no-store",signal}),data=await response.json();if(!response.ok||data.ok===!1)throw new Error(data.error||"HTTP "+String(response.status));return data}return function(props){let[state2,setState]=React.useState({loading:!0,error:"",info:null}),[selectedAddress,setSelectedAddress]=React.useState(""),[copied,setCopied]=React.useState(""),[switching,setSwitching]=React.useState(!1),abortRef=React.useRef(null),load=React.useCallback(async()=>{abortRef.current!==null&&abortRef.current.abort();let controller=typeof AbortController=="function"?new AbortController:null;abortRef.current=controller;try{let info2=await loadInfo(controller===null?void 0:controller.signal);setState({loading:!1,error:"",info:info2})}catch(value){if(value&&value.name==="AbortError")return;setState(previous=>({...previous,loading:!1,error:String(value&&value.message?value.message:value)}))}},[]);React.useEffect(()=>(load(),()=>{abortRef.current!==null&&abortRef.current.abort()}),[load]);let copy=React.useCallback(async(value,address)=>{if(value)try{navigator.clipboard&&typeof navigator.clipboard.writeText=="function"?await navigator.clipboard.writeText(value):fallbackCopy(document,value),setCopied(address),window.setTimeout(()=>setCopied(""),1500)}catch{try{fallbackCopy(document,value),setCopied(address),window.setTimeout(()=>setCopied(""),1500)}catch{window.prompt(t("copy"),value)}}},[]);if(state2.loading)return h("div",{className:"dshr-panel"},h("div",{className:"dshr-loading"},t("loading")));if(state2.error)return h("div",{className:"dshr-panel"},h("div",{className:"dshr-error"},t("error")+": "+state2.error),h("div",{className:"dshr-row"},h("button",{className:"dshr-btn",type:"button",onClick:load},t("refresh"))));let mobile=isMobileLayout2(),info=state2.info||{},members=Array.isArray(info.lanAddresses)?info.lanAddresses:[],warnings=Array.isArray(info.warnings)?info.warnings:[],auth=info.auth&&typeof info.auth=="object"?info.auth:{},selected=selectedAddress||members[0]&&members[0].address||"",url=selected&&members.some(row=>row.address===selected)?"http://"+selected+":"+String(info.listenPort)+"/":"",sourceKey=auth.source==="file"?"sourceFile":auth.source==="config"?"sourceConfig":"sourceDefault",onProxyOrigin=(window.location.port||(window.location.protocol==="https:"?"443":"80"))===String(info.listenPort||""),paused=info.paused===!0,control=onProxyOrigin?null:h("button",{className:"dshr-btn",type:"button",disabled:switching,onClick:async()=>{if(switching)return;let action=paused?"resume":"pause";setSwitching(!0);try{let body=await(await fetch("/api/remote/control?action="+action,{method:"POST",credentials:"same-origin"})).json().catch(()=>({}));body&&typeof body.paused=="boolean"&&setState(previous=>previous.info===null?previous:{...previous,info:{...previous.info,paused:body.paused}}),window.setTimeout(()=>{load()},action==="pause"?600:200)}catch(value){setState(previous=>({...previous,error:String(value&&value.message?value.message:value)}))}finally{setSwitching(!1)}}},t(switching?"switching":paused?"resume":"pause")),header=h("div",{className:"dshr-header"},h("div",null,h("h2",{className:"dshr-title"},t(mobile?"mobileMoreTitle":"title")),mobile?null:h("p",{className:"dshr-desc"},t("desc"))),h("button",{className:"dshr-btn",type:"button",onClick:load},t("refresh"))),tools=mobile?h("div",{className:"dshr-tools"},[["plugins",t("mobilePlugins")],["schedules",t("mobileSchedules")],["chatmanager",t("mobileTrash")]].map(([id,label])=>h("button",{key:id,type:"button",className:"dshr-tool",onClick:()=>{props&&typeof props.openPanel=="function"&&props.openPanel(id)}},h("span",{className:"dshr-toolLabel"},label),h("span",{className:"dshr-toolChevron","aria-hidden":"true"},"›")))):null,phase=info.proxy&&typeof info.proxy.phase=="string"?info.proxy.phase:"",transitioning=phase==="starting"||phase==="stopping",reachable=info.portProxyReachable===!0,statusTone=transitioning?"dshr-wait":reachable?"dshr-ok":"dshr-bad",statusText=t(transitioning?phase==="starting"?"starting":"stopping":reachable?"proxyOk":"proxyDown"),status=h("div",{className:"dshr-status "+statusTone},h("span",{className:"dshr-dot"}),h("span",null,statusText+" · "+t("dshPort")+" "+String(info.dshPort||"?")+" → "+t("lanPort")+" "+String(info.listenPort||"?"))),pairingCard=h("div",{className:"dshr-card"},h("div",{className:"dshr-row dshr-spread"},h("h3",{className:"dshr-sectionTitle"},t("pairing")),members.length>1?h("select",{className:"dshr-btn",value:selected,onChange:event=>setSelectedAddress(event.target.value)},members.map(row=>h("option",{key:row.address,value:row.address},row.address))):null),h("div",{className:"dshr-url"},url||t("pairingUnavailable")),selected?h("img",{className:"dshr-qr",src:"/api/remote/qr?address="+encodeURIComponent(selected),alt:t("qrAlt")+" "+selected,loading:"lazy"}):null,h("div",{className:"dshr-row"},h("button",{className:"dshr-btn dshr-primary",type:"button",onClick:()=>copy(url,selected),disabled:!url},t(copied===selected?"copied":"copy")),url?h("a",{className:"dshr-btn",href:url,target:"_blank",rel:"noreferrer"},t("open")):null),members.length===0?h("div",{className:"dshr-note"},t("noLan")):null),accountCard=h("div",{className:"dshr-card"},h("h3",{className:"dshr-sectionTitle"},t("account")),h("div",{className:"dshr-stack"},h("div",{className:"dshr-row dshr-spread"},h("span",{className:"dshr-label"},t("username")),h("span",null,String(auth.username||"admin"))),h("div",{className:"dshr-row dshr-spread"},h("span",{className:"dshr-label"},t("passwordSource")),h("span",{className:"dshr-small"},t(sourceKey))),h("div",{className:"dshr-row dshr-spread"},h("span",{className:"dshr-label"},t("dshPort")),h("span",{className:"dshr-small"},String(info.dshPort||"?"))),h("div",{className:"dshr-row dshr-spread"},h("span",{className:"dshr-label"},t("lanPort")),h("span",{className:"dshr-small"},String(info.listenPort||"?")))),onProxyOrigin?h("button",{className:"dshr-btn",type:"button",onClick:()=>{window.location.href="/__dsh_remote/logout"}},t("logout")):h("div",{className:"dshr-small"},t("localNoLogout")));return h("div",{className:"dshr-panel"},header,tools,status,control?h("div",{className:"dshr-row"},control):null,paused?h("div",{className:"dshr-note"},t("paused")):null,h("div",{className:"dshr-grid"},pairingCard,accountCard),auth.source==="default"?h("div",{className:"dshr-warning"},t("defaultPassword")):null,warnings.map((warning,index)=>h("div",{className:"dshr-warning",key:"warning-"+String(index)},warning)),h("div",{className:"dshr-security"},t("security")))}}function createDownloadAction(deps){let{h,React,t,icons}=deps;return function(props){let absolutePath=props&&props.absolutePath;if(!absolutePath)return null;let onClick=React.useCallback(()=>{let url="/api/remote/download?path="+encodeURIComponent(absolutePath),link=document.createElement("a");link.href=url,link.download=String(absolutePath).split(/[\\/]/).pop()||"download",link.rel="noopener",document.body.appendChild(link),link.click(),link.remove()},[absolutePath]);return h("button",{type:"button",className:"dshr-download",onClick,title:t("download"),"aria-label":t("download")},h(icons.DownloadIcon,{size:16}))}}function showUploadToast(document2,text){if(typeof document2>"u"||!document2.body||typeof document2.createElement!="function")return{set(){},error(){},remove(){}};let element2=document2.createElement("div");return element2.className="dshr-uploadToast",element2.textContent=text,document2.body.appendChild(element2),{set(value){element2.textContent=value},error(){element2.classList&&typeof element2.classList.add=="function"&&element2.classList.add("dshr-uploadToastError")},remove(){element2.remove()}}}var WINDOWS_ABSOLUTE=/^(?:[A-Za-z]:[\\/]|[\\/]{2})/,POINTER_EPSILON=8;function isAbsoluteClientPath(value){return typeof value=="string"&&WINDOWS_ABSOLUTE.test(value)}function filesDropTargetAt(document2,x,y){let element2;try{element2=typeof document2.elementFromPoint=="function"?document2.elementFromPoint(x,y):null}catch{element2=null}if(!element2)return;let row=typeof element2.closest=="function"?element2.closest(selectorFor("filesPath")):null;if(row!==null){let value=row.getAttribute("data-files-path");if(isAbsoluteClientPath(value))return{path:value,header:row}}let container=element2;for(let depth=0;container&&depth<10;depth+=1,container=container.parentElement){let header=container.querySelector('[data-files-path="true"]'),rows=container.querySelectorAll('[data-files-path]:not([data-files-path="true"])');if(header!==null&&rows.length>0){let value=String(header.textContent||"").trim();if(isAbsoluteClientPath(value))return{path:value,header}}}}function refreshFilesPanel(header){try{let container=header;for(let depth=0;container&&depth<6;depth+=1,container=container.parentElement){let button=[...container.querySelectorAll("button")].find(candidate=>/refresh|刷新/i.test(String(candidate.getAttribute("aria-label")||candidate.getAttribute("title")||"")));if(button!==void 0){button.click();return}}}catch{}}async function uploadFilesInto(target,files,t,document2){if(typeof fetch!="function"||!target||files.length===0)return;let toast=showUploadToast(document2,t("uploading")+" "+String(files.length)+" "+t("fileCount")+"…"),uploaded=0;try{for(let file of files){let name=String(file&&file.name?file.name:"upload.bin"),url="/api/remote/upload?path="+encodeURIComponent(target.path)+"&name="+encodeURIComponent(name),response=await fetch(url,{method:"POST",credentials:"same-origin",headers:{"content-type":"application/octet-stream"},body:file}),data=await response.json().catch(()=>({}));if(!response.ok||data.ok===!1)throw new Error(data.error||"HTTP "+String(response.status));uploaded+=1,toast.set(t("uploaded")+" "+String(uploaded)+"/"+String(files.length)+" "+t("fileCount"))}toast.set(t("uploaded")+" "+String(uploaded)+" "+t("fileCount")+" "+t("uploadTo")+" "+target.path),refreshFilesPanel(target.header),typeof window<"u"&&window.setTimeout(()=>toast.remove(),2600)}catch(error){toast.error(),toast.set(t("uploadFailed")+": "+String(error&&error.message?error.message:error)),typeof window<"u"&&window.setTimeout(()=>toast.remove(),5e3)}}function installFilesDropUpload(deps){let{document:document2,window:window2,t}=deps,target=typeof window2.addEventListener=="function"?window2:void 0;if(target===void 0)return()=>{};let active=!1,frame=0,pending={x:0,y:0,drop:void 0},setActive=value=>{if(active!==value){active=value;try{let root=document2.documentElement;root&&root.classList&&typeof root.classList.toggle=="function"&&root.classList.toggle("dshr-file-drop",value)}catch{}}},resolve=()=>{frame=0,pending.drop=filesDropTargetAt(document2,pending.x,pending.y),setActive(pending.drop!==void 0)},onDragOver=event=>{let data=event.dataTransfer;if(!data||!Array.from(data.types||[]).includes("Files"))return;let dx=Math.abs(event.clientX-pending.x),dy=Math.abs(event.clientY-pending.y);pending.x=event.clientX,pending.y=event.clientY,frame===0&&(dx>POINTER_EPSILON||dy>POINTER_EPSILON||pending.drop===void 0)&&(frame=typeof window2.requestAnimationFrame=="function"?window2.requestAnimationFrame(resolve):window2.setTimeout(resolve,16)),pending.drop!==void 0&&(event.preventDefault(),event.stopPropagation(),typeof event.stopImmediatePropagation=="function"&&event.stopImmediatePropagation(),data.dropEffect="copy")},onDragLeave=event=>{event.relatedTarget===null&&setActive(!1)},onDrop=event=>{let data=event.dataTransfer;if(!data||!data.files||data.files.length===0)return;let drop=filesDropTargetAt(document2,event.clientX,event.clientY);if(drop===void 0){setActive(!1);return}event.preventDefault(),event.stopPropagation(),typeof event.stopImmediatePropagation=="function"&&event.stopImmediatePropagation(),setActive(!1),uploadFilesInto(drop,[...data.files],t,document2)};return target.addEventListener("dragover",onDragOver,!0),target.addEventListener("dragleave",onDragLeave,!0),target.addEventListener("drop",onDrop,!0),()=>{target.removeEventListener("dragover",onDragOver,!0),target.removeEventListener("dragleave",onDragLeave,!0),target.removeEventListener("drop",onDrop,!0),frame!==0&&typeof window2.cancelAnimationFrame=="function"&&window2.cancelAnimationFrame(frame),setActive(!1)}}var ROUTE="/api/remote/browse";function element(tag,className,text){let node=document.createElement(tag);return className&&(node.className=className),text!==void 0&&(node.textContent=text),node}function messageOf(error){return error instanceof Error?error.message:String(error)}function showDirectoryDialog(options){let t=options.t;return new Promise(resolve=>{let current2="",busy=!1,closed=!1,previousOverflow=document.body.style.overflow;document.body.style.overflow="hidden";let overlay=element("div","dshr-picker-backdrop"),dialog=element("div","dshr-picker");dialog.setAttribute("role","dialog"),dialog.setAttribute("aria-modal","true"),dialog.setAttribute("aria-label",t("pickerTitle"));let head=element("div","dshr-picker-head");head.appendChild(element("strong","dshr-picker-title",t("pickerTitle")));let close=element("button","dshr-picker-close","×");close.type="button",close.setAttribute("aria-label",t("pickerCancel")),head.appendChild(close);let toolbar=element("div","dshr-picker-toolbar"),drive=element("select","dshr-picker-drive");drive.setAttribute("aria-label",t("pickerDrive"));let pathInput=element("input","dshr-picker-path");pathInput.type="text",pathInput.spellcheck=!1,pathInput.setAttribute("aria-label",t("pickerPath")),toolbar.append(drive,pathInput);let crumbs=element("div","dshr-picker-crumbs"),list=element("div","dshr-picker-list"),status=element("div","dshr-picker-status"),foot=element("div","dshr-picker-foot"),nameInput=element("input","dshr-picker-name");nameInput.type="text",nameInput.placeholder=t("pickerFolderName"),nameInput.setAttribute("aria-label",t("pickerFolderName"));let create=element("button","dshr-picker-button",t("pickerCreate"));create.type="button";let spacer=element("span","dshr-picker-spacer"),cancel=element("button","dshr-picker-button",t("pickerCancel"));cancel.type="button";let select=element("button","dshr-picker-button dshr-picker-primary",t("pickerSelect"));select.type="button",foot.append(nameInput,create,spacer,cancel,select),dialog.append(head,toolbar,crumbs,list,status,foot),overlay.appendChild(dialog),document.body.appendChild(overlay),select.focus();function finish(value){closed||(closed=!0,document.removeEventListener("keydown",onKey),document.body.style.overflow=previousOverflow,overlay.remove(),resolve(value))}function onKey(event){event.key==="Escape"&&(event.preventDefault(),finish(null))}document.addEventListener("keydown",onKey),overlay.addEventListener("mousedown",event=>{event.target===overlay&&finish(null)}),close.addEventListener("click",()=>finish(null)),cancel.addEventListener("click",()=>finish(null)),select.addEventListener("click",()=>{!busy&&current2.length>0&&finish(current2)}),drive.addEventListener("change",()=>{drive.value&&load(drive.value)}),pathInput.addEventListener("keydown",event=>{if(event.key!=="Enter")return;event.preventDefault();let value=pathInput.value.trim();value.length>0&&!busy&&load(value)});function setBusy(value){busy=value,select.disabled=value,create.disabled=value,nameInput.disabled=value,drive.disabled=value,pathInput.disabled=value}function setStatus(text,isError){status.textContent=text||"",status.classList.toggle("dshr-picker-error",isError===!0)}function render(data){current2=data.path;let roots=Array.isArray(data.roots)?data.roots:[];drive.replaceChildren();for(let root of roots){let option=document.createElement("option");option.value=root.path,option.textContent=root.name,drive.appendChild(option)}drive.style.display=roots.length>0?"":"none";let lower=data.path.toLowerCase(),matched=roots.find(root=>lower.startsWith(root.path.toLowerCase()));matched&&(drive.value=matched.path),document.activeElement!==pathInput&&(pathInput.value=data.path),crumbs.replaceChildren();let items=Array.isArray(data.crumbs)?data.crumbs:[];if(items.forEach((crumb,index)=>{let button=element("button","dshr-picker-crumb",crumb.name);button.type="button",button.title=crumb.path,index===items.length-1&&button.classList.add("dshr-picker-crumb-current"),button.addEventListener("click",()=>{load(crumb.path)}),crumbs.appendChild(button),index<items.length-1&&crumbs.appendChild(element("span","dshr-picker-sep","/"))}),list.replaceChildren(),items.length>1){let up=element("button","dshr-picker-row dshr-picker-up","..");up.type="button",up.title=t("pickerUp"),up.addEventListener("click",()=>{load(items[items.length-2].path)}),list.appendChild(up)}let entries=Array.isArray(data.entries)?data.entries:[];entries.length===0&&list.appendChild(element("div","dshr-picker-empty",t("pickerEmpty")));for(let entry of entries){let row=element("button","dshr-picker-row",entry.name);row.type="button",row.title=entry.path,entry.hidden&&row.classList.add("dshr-picker-hidden"),row.addEventListener("click",()=>{load(entry.path)}),list.appendChild(row)}setStatus(data.truncated?t("pickerTruncated"):"",!1)}async function load(path){if(!closed){setBusy(!0),setStatus(t("pickerLoading"),!1);try{let query=path?"?path="+encodeURIComponent(path):"",response=await fetch(ROUTE+query,{headers:{accept:"application/json"}}),body=await response.json().catch(()=>null);if(!response.ok||body===null||body.ok!==!0)throw new Error(body&&body.error?body.error:t("pickerError"));render(body)}catch(error){setStatus(messageOf(error),!0)}finally{setBusy(!1)}}}async function createFolder(){let name=nameInput.value.trim();if(!(name.length===0||busy)){setBusy(!0),setStatus(t("pickerLoading"),!1);try{let response=await fetch(ROUTE,{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({path:current2,name})}),body=await response.json().catch(()=>null);if(!response.ok||body===null||body.ok!==!0)throw new Error(body&&body.error?body.error:t("pickerCreateFailed"));nameInput.value="",await load(current2)}catch(error){setStatus(messageOf(error),!0)}finally{setBusy(!1)}}}create.addEventListener("click",()=>{createFolder()}),load("")})}function installRemoteDirectoryPicker(ctx,options){if(!options.isRemoteOrigin())return()=>{};let workspace=ctx.uiWorkspace;if(!workspace||typeof workspace.pickDirectory!="function")return()=>{};let original=workspace.pickDirectory,patched=function(){return showDirectoryDialog({t:options.t})};function patchOn(target2){try{target2.pickDirectory=patched}catch{}if(target2.pickDirectory===patched)return!0;try{Object.defineProperty(target2,"pickDirectory",{value:patched,configurable:!0,writable:!0})}catch{return!1}return target2.pickDirectory===patched}let target=workspace;if(!patchOn(target)){let proto=Object.getPrototypeOf(workspace);if(!proto||proto===Object.prototype||typeof proto.pickDirectory!="function")return()=>{};if(!patchOn(proto))return()=>{};target=proto}return()=>{if(target.pickDirectory===patched)try{target.pickDirectory=original}catch{}}}var SIGN_IN=/^(?:登录|登入|重新登录|sign in|sign in again|log in)$/i,SIGN_OUT=/^(?:退出登录|登出|sign out|log out)$/i,HIDDEN_ATTRIBUTE="data-dshr-acct-hidden";function labelOf(element2){return String(element2.textContent||"").replace(/\s+/g," ").trim()}function isAccountAction(element2){if(element2===null||typeof element2.getAttribute!="function")return!1;let tag=typeof element2.tagName=="string"?element2.tagName.toUpperCase():"";if(tag!==""&&tag!=="BUTTON")return!1;let label=labelOf(element2);return SIGN_IN.test(label)||SIGN_OUT.test(label)}function hideControl(node,marker){if(!isAccountAction(node))return!1;if(typeof node.hasAttribute=="function"&&node.hasAttribute(HIDDEN_ATTRIBUTE))return!0;let style=node.style;return style&&typeof style.setProperty=="function"?style.setProperty("display","none","important"):style&&(style.display="none"),typeof node.classList?.add=="function"&&node.classList.add(marker),typeof node.setAttribute=="function"&&node.setAttribute(HIDDEN_ATTRIBUTE,""),!0}function hideSubtree(root,marker){let count=0;try{typeof root.matches=="function"&&root.matches("button")&&hideControl(root,marker)&&(count+=1);for(let node of root.querySelectorAll("button"))hideControl(node,marker)&&(count+=1)}catch{}return count}function installAccountGuard(options){let{document:document2,window:window2,t}=options,marker=options.marker||"dshr-acct-off";if(typeof document2.addEventListener!="function")return()=>{};let disposed=!1,hidden=0,explain=()=>{let toast=showUploadToast(document2,t("accountRemoteOnly"));window2.setTimeout(()=>toast.remove(),3200)},scan=()=>{let nodes;try{nodes=document2.querySelectorAll("button")}catch{return hidden}let count=0;for(let node of nodes)hideControl(node,marker)&&(count+=1);return hidden=count,count},frame=0,scheduleScan=()=>{if(frame!==0||disposed)return;let run=()=>{frame=0,scan()};frame=typeof window2.requestAnimationFrame=="function"?window2.requestAnimationFrame(run):window2.setTimeout(run,16)},onClick=event=>{let target=event&&event.target;if(!target||typeof target.closest!="function")return;let control=target.closest("button");if(control!==null&&isAccountAction(control)){event.preventDefault(),event.stopImmediatePropagation(),hideControl(control,marker),explain();return}scheduleScan()},Observer=window2.MutationObserver||(typeof MutationObserver=="function"?MutationObserver:void 0),observer=typeof Observer=="function"?new Observer(records=>{if(!disposed)for(let record of records)for(let node of record.addedNodes)node!==null&&node.nodeType===1&&hideSubtree(node,marker)}):void 0;if(document2.addEventListener("click",onClick,!0),observer!==void 0)try{observer.observe(document2.body||document2.documentElement,{childList:!0,subtree:!0})}catch{}scan();try{globalThis.__dshRemoteAccountGuard={scan,hidden:()=>hidden,marker,observer:observer!==void 0}}catch{}return()=>{disposed=!0,document2.removeEventListener("click",onClick,!0),observer!==void 0&&observer.disconnect(),frame!==0&&(typeof window2.cancelAnimationFrame=="function"?window2.cancelAnimationFrame(frame):window2.clearTimeout(frame))}}var enabled=!1;try{typeof globalThis.localStorage<"u"&&(enabled=globalThis.localStorage.getItem("dshRemoteDebug")==="1")}catch{enabled=!1}function debug(scope,message){enabled&&console.log("[dsh-remote:"+scope+"] "+message)}var NS="dsh-remote",PANEL_ID="dsh-remote";function createPlugin(React){let h=React.createElement,translate=key=>key,t=key=>{try{return translate(key)}catch{return key}},icons=createIcons(h);return{inject:["slots","locale","uiWorkspace"],apply(ctx){translate=ctx.locale.bind(NS);let wantsMobile=()=>!isDesktopShell()&&(isRemoteOrigin()||forcedMobileMode()===!0);if(ctx.effect(()=>ctx.locale.register(NS,"en",en_default.plugin),"dsh-remote: en dictionary"),ctx.effect(()=>ctx.locale.register(NS,"zh",zh_default.plugin),"dsh-remote: zh dictionary"),ctx.effect(()=>{let style=document.createElement("style");return style.setAttribute("data-dsh-remote",""),style.textContent=panel_default+`
`+mobile_default+`
`+picker_default+`
`+account_default,document.head.appendChild(style),()=>style.remove()},"dsh-remote: styles"),ctx.effect(()=>installRemoteDirectoryPicker(ctx,{isRemoteOrigin,t}),"dsh-remote: remote directory picker"),ctx.effect(()=>{if(!isRemoteOrigin())return()=>{};let root=document.documentElement;return root.classList.add("dshr-remote"),()=>root.classList.remove("dshr-remote")},"dsh-remote: remote marker"),ctx.effect(()=>{if(!isRemoteOrigin())return()=>{};try{delete globalThis.__DSH_HOST_PATHS__}catch{}try{globalThis.__DSH_HOST_PATHS__=void 0}catch{}return()=>{}},"dsh-remote: host path bridge"),ctx.effect(()=>isRemoteOrigin()?installAccountGuard({document,window,t}):()=>{},"dsh-remote: account guard"),ctx.effect(()=>installRemoteToggleGuard(document,t),"dsh-remote: remote toggle guard"),ctx.effect(()=>installFilesDropUpload({document,window,t}),"dsh-remote: files drop upload"),ctx.slots.inject("main",()=>ctx.slots.register({name:"main",key:PANEL_ID,locale:NS,inject:()=>({openPanel:id=>{let layout=layoutOf(ctx);id&&layout&&typeof layout.selectPanel=="function"&&layout.selectPanel(id)}})},createRemotePanel({h,React,t,isMobileLayout,icons}))),ctx.slots.inject("sidebar.panellist",()=>ctx.slots.register({name:"sidebar.panellist",id:PANEL_ID,order:21,locale:NS,label:()=>t("panel")},icons.RemotePanelIcon)),isRemoteOrigin()){let downloadAction=createDownloadAction({h,React,t,icons});ctx.slots.inject("sidebar.right.tab.document.actions",()=>ctx.slots.register({name:"sidebar.right.tab.document.actions",id:"dsh-remote-download",order:100,locale:NS},downloadAction)),ctx.slots.inject("sidebar.right.tab.document.unpreviewable",()=>ctx.slots.register({name:"sidebar.right.tab.document.unpreviewable",id:"dsh-remote-download",order:100,locale:NS},downloadAction))}installMobileLayer(ctx,wantsMobile)}};function installMobileLayer(ctx,wantsMobile){if(!wantsMobile())return;let disposed=!1;ctx.effect(()=>()=>{disposed=!0},"dsh-remote: mobile lifetime"),waitForShell(document,window).then(caps=>{if(disposed)return;if(publish(document.documentElement,caps),!caps.ok){debug("mobile","mobile layer disabled; missing anchors: "+caps.missing.join(", "));return}let root=document.documentElement,enable=()=>{let mobile=isMobileLayout();typeof root.classList.toggle=="function"&&root.classList.toggle("dshm-mobile",mobile),mobile&&(applyMobileViewport(document),isRemoteOrigin()&&root.classList.add("dshr-remote"))};enable(),ctx.effect(()=>{let onChange=()=>enable();window.addEventListener("resize",onChange,{passive:!0}),window.addEventListener("orientationchange",onChange,{passive:!0});let media;if(typeof window.matchMedia=="function")try{media=window.matchMedia("(max-width: 900px)"),media&&typeof media.addEventListener=="function"?media.addEventListener("change",onChange):media&&typeof media.addListener=="function"&&media.addListener(onChange)}catch{media=void 0}return()=>{window.removeEventListener("resize",onChange),window.removeEventListener("orientationchange",onChange),media&&(typeof media.removeEventListener=="function"?media.removeEventListener("change",onChange):typeof media.removeListener=="function"&&media.removeListener(onChange))}},"dsh-remote: mobile viewport"),ctx.effect(()=>installViewport(document.documentElement,window),"dsh-remote: keyboard"),enable(),ctx.effect(()=>installChrome({document,window,panelId:PANEL_ID,readPanel:()=>{let layout=layoutOf(ctx),panelInfo=layout&&layout.panelInfo;if(!(!panelInfo||typeof panelInfo.getSnapshot!="function"))try{return panelInfo.getSnapshot()}catch{return}},onView:()=>{}}),"dsh-remote: chrome sync"),window.setTimeout(()=>{try{document.documentElement.classList.contains("dshm-mobile")&&applyFrameClass(document)}catch{}},0),ctx.effect(()=>installMobileInteractions({document,window,ctx}),"dsh-remote: mobile interactions"),ctx.slots.inject("shell.bottom",()=>ctx.slots.register({name:"shell.bottom",id:"dsh-remote-mobile-nav",locale:NS},createMobileNav({h,React,t,ctx,panelId:PANEL_ID,glyphs:icons,onView:()=>{}})))})}}function installRemoteToggleGuard(document2,t){if(typeof document2.addEventListener!="function")return()=>{};let onClick=event=>{let target=event&&event.target;if(!target||typeof target.closest!="function")return;let toggle=target.closest('button[role="switch"]');if(toggle===null)return;let label=String(toggle.getAttribute("aria-label")||"");if(!/远程访问|remote access/i.test(label))return;event.preventDefault(),event.stopImmediatePropagation();let toast=showUploadToast(document2,t("toggleUsePanel"));window.setTimeout(()=>toast.remove(),3200)};return document2.addEventListener("click",onClick,!0),()=>document2.removeEventListener("click",onClick,!0)}installUrlCompat(typeof window>"u"?void 0:window);window.__ModuleLoader__.load({id:"dsh-remote",factory(require2){return createPlugin(require2("react"))}});})();
