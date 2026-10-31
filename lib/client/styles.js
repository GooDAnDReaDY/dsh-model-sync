// Modular client stylesheet and DOM injection for @goodandready/dsh-model-sync (#279)

export const PLUGIN_ID = '@goodandready/dsh-model-sync'
export const STYLE_ID = 'dsh-model-sync-styles'
export const CSS_MODULE_ID = 'dsh-model-sync/settings.module.css'

export const CSS = '.dms-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;margin:0;padding:0;overflow:hidden;box-sizing:border-box}' +
      '.dms-card-open{background:var(--dsw-alias-bg-layer-3);border-color:var(--dsw-alias-border-l2)}' +
      '.dms-card-header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;display:flex;align-items:center;gap:12px;padding:14px 16px}' +
      '.dms-card-header:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2))}' +
      '.dms-card-header:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}' +
      '.dms-card-head-text{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}' +
      '.dms-card-name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}' +
      '.dms-card-description{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.45}' +
      '.dms-card-chevron{color:var(--dsw-alias-label-tertiary);flex:0 0 auto;transition:transform .12s}.dms-card-chevron-open{transform:rotate(180deg)}' +
      '.dms-card-body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px;display:flex;flex-direction:column;gap:10px;box-sizing:border-box}' +
      '.dms-wrap{display:flex;flex-direction:column;gap:14px;max-width:760px;box-sizing:border-box;color:var(--dsw-alias-label-primary,inherit)}' +
      '.dms-wrap>p{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55}' +
      '.dms-toolbar,.dms-section{display:flex;flex-direction:row;align-items:center;flex-wrap:wrap;gap:10px;padding:13px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1,transparent);box-sizing:border-box}' +
      '.dms-toolbar>select{flex:1 1 190px;min-width:190px}' +
      '.dms-toolbar>.dms-actions{flex-basis:100%}' +
      '.dms-toolbar>label{display:inline-flex;align-items:flex-start;gap:7px;font-size:12px;line-height:1.35;color:var(--dsw-alias-label-secondary)}' +
      '.dms-toolbar>select,.dms-editor input,.dms-editor textarea,.dms-input{box-sizing:border-box;min-width:0;background:var(--dsw-specific-input-major,var(--dsw-alias-bg-layer-2,transparent));border:1px solid var(--dsw-alias-border-l1,var(--dsw-alias-border-l2));border-radius:6px;color:var(--dsw-alias-label-primary);font:inherit;padding:7px 9px}' +
      '.dms-toolbar>label input{accent-color:var(--dsw-alias-brand-primary,var(--dsw-alias-button-info-fill))}' +
      '.dms-actions{display:flex;align-items:center;flex-wrap:wrap;gap:7px}' +
      '.dms-wrap>.dms-actions{padding:10px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1,transparent)}' +
      '.dms-btn{margin:0!important;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:1.35;padding:6px 10px;cursor:pointer;white-space:normal}' +
      '.dms-btn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}' +
      '.dms-btn:disabled{opacity:.45;cursor:default}' +
      '.dms-section>strong{display:block;font-size:13px;font-weight:650}' +
      '.dms-provider-wrap{margin:0 0 7px}' +
      '.dms-provider{display:grid!important;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:10px 11px;margin:0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2,transparent)}' +
      '.dms-provider>span{min-width:0;overflow-wrap:anywhere;line-height:1.4}' +
      '.dms-section>div[style]{padding:8px 0;border-top:1px solid var(--dsw-alias-border-l2)}' +
      '.dms-editor{display:flex;flex-direction:column;align-items:stretch;gap:10px;padding:13px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1,transparent);box-sizing:border-box;border-color:var(--dsw-alias-brand-primary,var(--dsw-alias-border-l2))}' +
      '.dms-editor strong{font-size:13px}' +
      '.dms-editor label{display:block;gap:5px;margin-top:8px;color:var(--dsw-alias-label-secondary);font-size:12px}' +
      '.dms-editor label input,.dms-editor label textarea{width:100%}' +
      '.dms-editor input[type="checkbox"]{width:auto;accent-color:var(--dsw-alias-brand-primary)}' +
      '.dms-section-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box}' +
      '.dms-section-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary);display:flex;align-items:center;justify-content:space-between;line-height:1.4}' +
      '.dms-section-desc{font-size:13px;color:var(--dsw-alias-label-secondary);margin-top:-6px;line-height:1.4}' +
      '.dms-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
      '.dms-grid-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}' +
      '.dms-badge{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);display:inline-flex;align-items:center;gap:4px;font-weight:500}' +
      '.dms-badge-ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-state-success-secondary,var(--dsw-alias-bg-layer-2))}' +
      '.dms-badge-warn{border-color:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary);background:var(--dsw-alias-state-warn-secondary,var(--dsw-alias-bg-layer-2))}' +
      '.dms-badge-bad{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-state-error-secondary,var(--dsw-alias-bg-layer-2))}' +
      '.dms-input{height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:6px;padding:0 10px;font-size:13px;box-sizing:border-box}' +
      '.dms-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}' +
      '.dms-btn-primary{background:var(--dsw-alias-label-primary)!important;color:var(--dsw-alias-bg-layer-3)!important;border-color:transparent!important;font-weight:600}' +
      '.dms-btn-primary:hover:not(:disabled){opacity:0.88}' +
      '.dms-btn-danger{color:var(--dsw-alias-state-error-primary)!important;border-color:var(--dsw-alias-state-error-primary)!important}' +
      '.dms-btn-danger:hover:not(:disabled){background:var(--dsw-alias-state-error-secondary,var(--dsw-alias-bg-layer-2))!important;border-color:var(--dsw-alias-state-error-primary)!important}' +
      '.dms-alert{padding:10px 14px;border-radius:8px;font-size:13px}' +
      '.dms-alert-ok{background:var(--dsw-alias-state-success-secondary,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-state-success-primary)}' +
      '.dms-alert-bad{background:var(--dsw-alias-state-error-secondary,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-state-error-primary)}' +
      '.dms-probe-result{padding:2px 6px;border-radius:4px;font-family:monospace;font-size:11px;border:1px solid var(--dsw-alias-border-l2);display:inline-flex;align-items:center;gap:4px}' +
      '.dms-pill{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:3px 9px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}' +
      '.dms-pill:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}' +
      '.dms-pill-active{background:var(--dsw-alias-label-primary)!important;color:var(--dsw-alias-bg-layer-3)!important;border-color:transparent!important;font-weight:600}' +
      '.dms-tier-lightning{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-secondary)}' +
      '.dms-tier-fast{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-state-success-secondary)}' +
      '.dms-tier-moderate{border-color:var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary);background:var(--dsw-alias-state-warn-secondary)}' +
      '.dms-tier-slow{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-state-error-secondary)}' +
      '.dms-badge-verified{font-size:10px;padding:0 4px;border-radius:3px;background:var(--dsw-alias-state-success-secondary);color:var(--dsw-alias-state-success-primary);border:1px solid var(--dsw-alias-state-success-primary)}' +
      '.dms-sparkline{font-family:monospace;letter-spacing:-1px;margin-left:3px;font-weight:bold}' +
      '@media (max-width:540px){.dms-provider{grid-template-columns:1fr!important}.dms-provider .dms-btn{justify-self:start}.dms-toolbar>div:first-child{align-items:stretch;flex-direction:column}.dms-toolbar>div:first-child select{width:100%}.dms-toolbar,.dms-section,.dms-section-card,.dms-editor{padding:11px 12px}}'

export function ensureStyles() {
  if (typeof document === 'undefined' || !document.head) return
  const pluginId = '@goodandready/dsh-model-sync'
  const styleId = 'dsh-model-sync-styles'
  const cssId = 'dsh-model-sync/settings.module.css'
  let tag = document.getElementById(styleId) || document.querySelector('style[data-plugin="' + pluginId + '"]') || document.querySelector('style[data-dsh-plugin="' + pluginId + '"]') || document.querySelector('style[data-plugin="dsh-model-sync"]') || document.querySelector('style[data-dsh-plugin="dsh-model-sync"]')
  if (tag) {
    if (tag.textContent !== CSS) tag.textContent = CSS
    tag.setAttribute('data-plugin', pluginId)
    tag.setAttribute('data-dsh-plugin', pluginId)
    return tag
  }
  tag = document.createElement('style')
  tag.id = styleId
  tag.textContent = CSS
  tag.setAttribute('data-plugin', pluginId)
  tag.setAttribute('data-dsh-plugin', pluginId)
  tag.setAttribute('data-plugin-css', cssId)
  document.head.appendChild(tag)
  return tag
}
