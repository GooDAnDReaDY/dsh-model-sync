window.__ModuleLoader__.load({
  id: '@goodandready/dsh-model-sync',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')

    const CSS = '.dms-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;margin:0;padding:0;overflow:hidden;box-sizing:border-box}' +
      '.dms-card-open{background:var(--dsw-alias-bg-layer-3);border-color:var(--dsw-alias-border-l2)}' +
      '.dms-card-header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;display:flex;align-items:center;gap:12px;padding:14px 16px}' +
      '.dms-card-header:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.05))}' +
      '.dms-card-header:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}' +
      '.dms-card-head-text{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}' +
      '.dms-card-name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}' +
      '.dms-card-description{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.45}' +
      '.dms-card-chevron{color:var(--dsw-alias-label-tertiary);flex:0 0 auto;transition:transform .12s}.dms-card-chevron-open{transform:rotate(180deg)}' +
      '.dms-card-body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px;display:flex;flex-direction:column;gap:10px;box-sizing:border-box}' +
      '.dms-wrap{display:flex;flex-direction:column;gap:14px;max-width:760px;box-sizing:border-box;color:var(--dsw-alias-label-primary,inherit)}' +
      '.dms-wrap>p{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55}' +
      '.dms-toolbar,.dms-section{display:flex;flex-direction:row;align-items:center;flex-wrap:wrap;gap:10px;padding:13px 14px;border:1px solid var(--dsw-alias-border-l2,var(--dsw-alias-border-primary,rgba(255,255,255,.14)));border-radius:10px;background:var(--dsw-alias-bg-layer-1,transparent);box-sizing:border-box}' +
      '.dms-toolbar>select{flex:1 1 190px;min-width:190px}' +
      '.dms-toolbar>.dms-actions{flex-basis:100%}' +
      '.dms-toolbar>label{display:inline-flex;align-items:flex-start;gap:7px;font-size:12px;line-height:1.35;color:var(--dsw-alias-label-secondary)}' +
      '.dms-toolbar>select,.dms-editor input,.dms-editor textarea,.dms-input{box-sizing:border-box;min-width:0;background:var(--dsw-specific-input-major,var(--dsw-alias-bg-layer-2,transparent));border:1px solid var(--dsw-alias-border-l1,var(--dsw-alias-border-l2));border-radius:6px;color:var(--dsw-alias-label-primary);font:inherit;padding:7px 9px}' +
      '.dms-toolbar>label input{accent-color:var(--dsw-alias-brand-primary,var(--dsw-alias-button-info-fill))}' +
      '.dms-actions{display:flex;align-items:center;flex-wrap:wrap;gap:7px}' +
      '.dms-wrap>.dms-actions{padding:10px 14px;border:1px solid var(--dsw-alias-border-l2,var(--dsw-alias-border-primary,rgba(255,255,255,.14)));border-radius:10px;background:var(--dsw-alias-bg-layer-1,transparent)}' +
      '.dms-btn{margin:0!important;border:1px solid var(--dsw-alias-border-l2,var(--dsw-alias-border-primary));border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:1.35;padding:6px 10px;cursor:pointer;white-space:normal}' +
      '.dms-btn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.05))}' +
      '.dms-btn:disabled{opacity:.45;cursor:default}' +
      '.dms-section>strong{display:block;font-size:13px;font-weight:650}' +
      '.dms-provider-wrap{margin:0 0 7px}' +
      '.dms-provider{display:grid!important;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:10px 11px;margin:0;border:1px solid var(--dsw-alias-border-l2,var(--dsw-alias-border-primary));border-radius:8px;background:var(--dsw-alias-bg-layer-2,transparent)}' +
      '.dms-provider>span{min-width:0;overflow-wrap:anywhere;line-height:1.4}' +
      '.dms-section>div[style]{padding:8px 0;border-top:1px solid var(--dsw-alias-border-l2)}' +
      '.dms-editor{display:flex;flex-direction:column;align-items:stretch;gap:10px;padding:13px 14px;border:1px solid var(--dsw-alias-border-l2,var(--dsw-alias-border-primary));border-radius:10px;background:var(--dsw-alias-bg-layer-1,transparent);box-sizing:border-box;border-color:var(--dsw-alias-brand-primary,var(--dsw-alias-border-l2))}' +
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
      '.dms-badge-ok{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary);background:rgba(16,185,129,0.08)}' +
      '.dms-badge-warn{border-color:var(--dsw-alias-state-warning-primary);color:var(--dsw-alias-state-warning-primary);background:rgba(245,158,11,0.08)}' +
      '.dms-badge-bad{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);background:rgba(239,68,68,0.08)}' +
      '.dms-input{height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:6px;padding:0 10px;font-size:13px;box-sizing:border-box}' +
      '.dms-input:focus{outline:none;border-color:var(--dsw-alias-state-brand-primary)}' +
      '.dms-btn-primary{background:var(--dsw-alias-label-primary)!important;color:var(--dsw-alias-bg-layer-3)!important;border-color:transparent!important;font-weight:600}' +
      '.dms-btn-primary:hover:not(:disabled){opacity:0.88}' +
      '.dms-btn-danger{color:var(--dsw-alias-state-error-primary)!important;border-color:rgba(239,68,68,0.3)!important}' +
      '.dms-btn-danger:hover:not(:disabled){background:rgba(239,68,68,0.12)!important;border-color:rgba(239,68,68,0.5)!important}' +
      '.dms-alert{padding:10px 14px;border-radius:8px;font-size:13px}' +
      '.dms-alert-ok{background:rgba(16,185,129,0.1);color:var(--dsw-alias-state-success-primary)}' +
      '.dms-alert-bad{background:rgba(239,68,68,0.1);color:var(--dsw-alias-state-error-primary)}' +
      '.dms-probe-result{padding:2px 6px;border-radius:4px;font-family:monospace;font-size:11px;border:1px solid var(--dsw-alias-border-l2);display:inline-flex;align-items:center;gap:4px}' +
      '@media (max-width:540px){.dms-provider{grid-template-columns:1fr!important}.dms-provider .dms-btn{justify-self:start}.dms-toolbar>div:first-child{align-items:stretch;flex-direction:column}.dms-toolbar>div:first-child select{width:100%}.dms-toolbar,.dms-section,.dms-section-card,.dms-editor{padding:11px 12px}}'

    function createErrorBoundary() {
      if (!React || typeof React.Component !== 'function') {
        return function NoopBoundary(props) { return props?.children || null }
      }
      return class ErrorBoundary extends React.Component {
        constructor(props) {
          super(props)
          this.state = { hasError: false, error: null }
        }
        static getDerivedStateFromError(error) {
          return { hasError: true, error }
        }
        componentDidCatch(error, errorInfo) {
          console.error('[dsh-model-sync] React Error:', error, errorInfo)
        }
        render() {
          if (this.state.hasError) {
            return React.createElement(
              'div',
              {
                className: 'dms-alert dms-alert-bad',
                style: { margin: '12px 0', padding: '14px', borderRadius: '8px', border: '1px solid var(--dsw-alias-state-error-primary)' },
              },
              React.createElement('div', { style: { fontWeight: 600, marginBottom: '6px' } }, '⚠️ Model Sync UI Error:'),
              React.createElement('div', { style: { fontSize: '12px', wordBreak: 'break-all' } }, String(this.state.error?.message || this.state.error)),
              React.createElement('button', {
                type: 'button',
                className: 'dms-btn',
                style: { marginTop: '8px' },
                onClick: () => this.setState({ hasError: false, error: null })
              }, 'Retry')
            )
          }
          return this.props.children
        }
      }
    }
    const ErrorBoundary = createErrorBoundary()

    function ensureStyles() {
      if (typeof document === 'undefined' || !document.head) return
      const cssId = 'dsh-model-sync/settings.module.css'
      if (document.querySelector('style[data-plugin-css="' + cssId + '"]') || document.querySelector('style[data-dsh-plugin="dsh-model-sync"]')) return
      const tag = document.createElement('style')
      tag.textContent = CSS
      tag.setAttribute('data-plugin', 'dsh-model-sync')
      tag.setAttribute('data-dsh-plugin', 'dsh-model-sync')
      tag.setAttribute('data-plugin-css', cssId)
      document.head.appendChild(tag)
    }

    const en = {
      title: 'Model synchronization',
      showSettings: 'Show settings', hideSettings: 'Hide settings',
      desc: 'Refresh model catalogs for API-key providers. A dry-run is the default; applying changes is explicit.',
      loading: 'Loading…',
      refresh: 'Refresh status',
      refreshAll: 'Refresh all',
      run: 'Discover',
      apply: 'Apply changes',
      dryRun: 'Preview only (dry-run)',
      all: 'All API-key providers',
      ok: 'ready',
      dormant: 'not configured',
      running: 'running…',
      noProviders: 'No API-key providers found.',
      lastRun: 'Last run',
      previewTitle: 'Changes preview',
      previewNone: 'No changes detected.',
      previewAdded: 'Added',
      previewRemoved: 'Removed',
      previewChanged: 'Changed',
      previewApply: 'Apply preview',
      previewDismiss: 'Close preview',
      selectModels: 'Choose models',
      saveSelection: 'Save and apply selection',
      selectAtLeastOne: 'Select at least one model or use All models.',
      cancel: 'Cancel',
      selected: 'selected',
      allModels: 'All models',
      noModels: 'No models in the current catalog.',
      capabilityFilter: 'Filter by capabilities',
      capabilityCount: 'shown',
      noCapabilities: 'No capability metadata in this catalog.',
      pickerNote: 'The selection is applied to the DSH model picker immediately.',
      health: 'Check availability',
      healthOk: 'available',
      healthError: 'unavailable',
      healthDormant: 'not configured',
      policy: 'Manual model selection',
      savePolicy: 'Save policy',
      policyInclude: 'Include patterns (one per line)',
      policyExclude: 'Exclude patterns (one per line)',
      policyRequire: 'Required capabilities (comma-separated)',
      policyDeny: 'Denied capabilities (comma-separated)',
      policyNote: 'Patterns match model id, name, and tags. Apply changes to update the DSH picker.',
      scheduler: 'Scheduler',
      nextRun: 'next run',
      schedulerOff: 'off',
      schedulerOn: 'on',
      removeMissing: 'Confirm stale removal',
      stale: 'stale',
      deprecated: 'deprecated',
      history: 'Synchronization history',
      historyRun: 'Run',
      diffAdded: 'added',
      diffRemoved: 'removed',
      diffRenamed: 'renamed',
      diffChanged: 'metadata changed',
      rollback: 'Rollback catalog',
      rollbackConfirm: 'Rollback this provider catalog to the selected snapshot?',
      credentials: 'Credential diagnostics',
      checkCredentials: 'Check credentials',
      missingCredential: 'not configured',
      credentialReady: 'configured',
      report: 'Run report',
      success: 'success',
      partial: 'partial success',
      failure: 'failed',
      empty: 'no configured providers',
      notifications: 'Notifications',
      markRead: 'Mark read',
      acknowledge: 'Acknowledge',
      noNotifications: 'No notifications.',
      selectAllFiltered: 'Select all shown',
      deselectAllFiltered: 'Deselect all shown',
      invertFiltered: 'Invert selection',
      filterContext100k: 'Context ≥ 100k',
      filterCheap: 'Cheap ≤ $1/1M',
      showMore: 'Show more (%d)',
      showingCount: 'Showing %d of %d models',
      deprecatesIn: 'Deprecates in %dd',
      cacheHoursAgo: 'cache %dh ago',
      noHistory: 'No synchronization history.',
      searchPlaceholder: 'Search id/name/tag',
      sortName: 'Name A→Z',
      sortPrice: 'Price ↑',
      sortContext: 'Context ↓',
      sortDate: 'Newest ↓',
      schedulerSettings: 'Scheduler configuration',
      scheduleEnabled: 'Enable background schedule',
      intervalMinutes: 'Interval (minutes)',
      autoApplySchedule: 'Auto-apply changes',
      saveScheduler: 'Save scheduler',
      schedulerSaved: 'Saved',
      scopeUnavailable: 'Settings service unavailable.',
      invalidPattern: 'Invalid regex pattern: %s',
      batchTry: 'Test Selected',
      batchTryRunning: 'Testing...',
      batchTryDeselectUnreachable: 'Deselect unreachable',
      batchTryResults: 'Batch test: %d/%d reached',
      filterCostContext: 'Cost & Context limits',
      enableCostFilter: 'Filter by maximum price',
      maxPricePerMillion: 'Max price ($ / 1M tokens)',
      enableContextFilter: 'Filter by minimum context',
      minContextTokens: 'Min context window (tokens)',
      exportConfig: 'Export configuration',
      importConfig: 'Import configuration',
      exportImportTitle: 'Configuration Backup & Restore',
      importSuccess: 'Configuration imported successfully',
      importError: 'Import failed: %s',
      importPlaceholder: 'Paste JSON configuration here…',
      modelAliases: 'Model Aliases',
      aliasPlaceholder: 'Alias (e.g. gpt-4o-latest)',
      targetModel: 'Target model',
      addAlias: 'Save alias',
      removeAlias: 'Delete alias',
      noAliases: 'No model aliases defined.',
      targetProvider: 'Provider',
    }

    const zh = {
      title: '模型同步',
      showSettings: '展开设置', hideSettings: '收起设置',
      desc: '为配置了 API 密钥的服务商刷新模型目录。默认仅预览变更（dry-run）；需显式确认以应用更改。',
      loading: '加载中…',
      refresh: '刷新状态',
      refreshAll: '全部刷新',
      run: '发现模型',
      apply: '应用变更',
      dryRun: '仅预览（dry-run）',
      all: '所有 API 密钥服务商',
      ok: '就绪',
      dormant: '未配置',
      running: '运行中…',
      noProviders: '未找到任何已配置的服务商。',
      lastRun: '上次运行',
      previewTitle: '变更预览',
      previewNone: '未检测到任何变更。',
      previewAdded: '新增',
      previewRemoved: '已移除',
      previewChanged: '已更改',
      previewApply: '应用预览中的变更',
      previewDismiss: '关闭预览',
      selectModels: '选择模型',
      saveSelection: '保存并应用选择',
      selectAtLeastOne: '请至少选择一个模型，或使用“全部模型”。',
      cancel: '取消',
      selected: '已选',
      allModels: '全部模型',
      noModels: '当前目录中没有模型。',
      capabilityFilter: '按能力筛选',
      capabilityCount: '已显示',
      noCapabilities: '此目录中没有能力元数据。',
      pickerNote: '所选模型将立即生效至 DSH 模型选择器。',
      health: '检查可用性',
      healthOk: '可用',
      healthError: '不可用',
      healthDormant: '未配置',
      policy: '手动模型选择',
      savePolicy: '保存策略',
      policyInclude: '包含规则（每行一个正则表达式）',
      policyExclude: '排除规则（每行一个正则表达式）',
      policyRequire: '必需能力（逗号分隔）',
      policyDeny: '禁止能力（逗号分隔）',
      policyNote: '规则将匹配模型 ID、名称和标签。点击应用变更后更新 DSH 选择器。',
      scheduler: '定时同步',
      nextRun: '下次运行',
      schedulerOff: '已关闭',
      schedulerOn: '已开启',
      removeMissing: '确认移除失效模型',
      stale: '过期',
      deprecated: '已弃用',
      history: '同步历史',
      historyRun: '运行记录',
      diffAdded: '新增',
      diffRemoved: '移除',
      diffRenamed: '重命名',
      diffChanged: '元数据变更',
      rollback: '回滚目录',
      rollbackConfirm: '确定要将该服务商目录回滚至所选快照吗？',
      credentials: '凭据诊断',
      checkCredentials: '检查凭据',
      missingCredential: '未配置',
      credentialReady: '已配置',
      report: '运行报告',
      success: '成功',
      partial: '部分成功',
      failure: '失败',
      empty: '无配置的服务商',
      notifications: '系统通知',
      markRead: '标记已读',
      acknowledge: '确认知晓',
      noNotifications: '暂无通知。',
      selectAllFiltered: '全选已筛选',
      deselectAllFiltered: '取消全选已筛选',
      invertFiltered: '反向选择',
      filterContext100k: '上下文 ≥ 100k',
      filterCheap: '经济型 ≤ $1/1M',
      showMore: '加载更多 (%d)',
      showingCount: '正在显示 %d / %d 个模型',
      deprecatesIn: '将在 %d 天后弃用',
      cacheHoursAgo: '缓存于 %d 小时前',
      noHistory: '暂无同步历史。',
      searchPlaceholder: '搜索 ID / 名称 / 标签',
      sortName: '名称 A→Z',
      sortPrice: '价格 ↑',
      sortContext: '上下文 ↓',
      sortDate: '最新 ↓',
      schedulerSettings: '定时计划设置',
      scheduleEnabled: '开启后台定时同步',
      intervalMinutes: '间隔时间（分钟）',
      autoApplySchedule: '自动应用变更',
      saveScheduler: '保存计划',
      schedulerSaved: '已保存',
      scopeUnavailable: '设置服务不可用。',
      invalidPattern: '正则表达式无效：%s',
      batchTry: '批量测试选中模型',
      batchTryRunning: '测试中...',
      batchTryDeselectUnreachable: '取消选中不可用模型',
      batchTryResults: '批量测试：%d/%d 成功',
      filterCostContext: '价格与上下文限制',
      enableCostFilter: '启用最高价格过滤',
      maxPricePerMillion: '最高价格（$/百万Token）',
      enableContextFilter: '启用最小上下文过滤',
      minContextTokens: '最小上下文窗口（Token）',
      exportConfig: '导出配置',
      importConfig: '导入配置',
      exportImportTitle: '配置备份与恢复',
      importSuccess: '配置导入成功',
      importError: '导入失败：%s',
      importPlaceholder: '在此粘贴 JSON 配置内容…',
      modelAliases: '模型别名映射',
      aliasPlaceholder: '别名（例如 gpt-4o-latest）',
      targetModel: '目标模型',
      addAlias: '保存别名',
      removeAlias: '删除别名',
      noAliases: '未定义任何模型别名。',
      targetProvider: '服务商',
    }

    const API = '/dsh-model-sync'
    const CAPABILITY_LABELS = {
      vision: { en: 'Vision', zh: '视觉' },
      tools: { en: 'Tools', zh: '工具调用' },
      reasoning: { en: 'Reasoning', zh: '深度思考' },
      embeddings: { en: 'Embeddings', zh: '嵌入向量' },
    }

    function filterModelsByCapabilities(models, selected) {
      const required = [...new Set((selected ?? []).filter((key) => typeof key === 'string' && key))]
      return (models ?? []).filter((model) => required.every((key) => model?.capabilities?.[key] === true))
    }

    const NS = 'dsh-model-sync'

    function useLocale(ctx) {
      return React.useSyncExternalStore(
        React.useMemo(() => (cb) => ctx.locale?.subscribe?.(cb) ?? (() => {}), [ctx]),
        React.useCallback(() => ctx.locale?.getSnapshot?.().active ?? 'en', [ctx])
      )
    }

    function ModelSyncSection({ ctx, includeIntro = true }) {
      const locale = useLocale(ctx)
      const t = locale === 'zh' ? zh : en
      const [status, setStatus] = React.useState(null)
      const [provider, setProvider] = React.useState('')
      const [dryRun, setDryRun] = React.useState(true)
      const [removeMissing, setRemoveMissing] = React.useState(false)
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState('')
      const [credentialStatus, setCredentialStatus] = React.useState(null)
      const [selectionProvider, setSelectionProvider] = React.useState('')
      const [selectionDraft, setSelectionDraft] = React.useState([])
      const [capabilityFilter, setCapabilityFilter] = React.useState([])
      const [searchQuery, setSearchQuery] = React.useState('')
      const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('')
      const [sortBy, setSortBy] = React.useState('name')

      React.useEffect(() => {
        const timer = setTimeout(() => { setDebouncedSearchQuery(searchQuery) }, 150)
        return () => clearTimeout(timer)
      }, [searchQuery])

      const [preview, setPreview] = React.useState(null)
      const [policyProvider, setPolicyProvider] = React.useState('')
      const [policyDraft, setPolicyDraft] = React.useState({
        include: '',
        exclude: '',
        requireCapabilities: '',
        denyCapabilities: '',
        enableCostFilter: false,
        maxPricePerMillion: '',
        enableContextFilter: false,
        minContextTokens: '',
      })
      const [pageSize, setPageSize] = React.useState(50)
      const [quickFilter, setQuickFilter] = React.useState({ context100k: false, cheap: false })
      const [tryState, setTryState] = React.useState({})
      const [batchTrying, setBatchTrying] = React.useState(false)
      const [batchSummary, setBatchSummary] = React.useState(null)

      const [aliasDraft, setAliasDraft] = React.useState({ alias: '', provider: '', model: '' })
      const [aliasMsg, setAliasMsg] = React.useState('')
      const [aliasErr, setAliasErr] = React.useState('')

      const [importText, setImportText] = React.useState('')
      const [importMsg, setImportMsg] = React.useState('')
      const [importErr, setImportErr] = React.useState('')
      const [showImportBox, setShowImportBox] = React.useState(false)

      const scope = React.useMemo(() => (ctx && ctx.settingsScope ? ctx.settingsScope.bind({ namespace: NS }) : undefined), [ctx])
      const snapshot = React.useSyncExternalStore(
        React.useMemo(() => (cb) => (scope ? scope.subscribe(cb) : () => {}), [scope]),
        React.useCallback(() => (scope ? scope.getSnapshot() : { status: 'loading' }), [scope]),
        React.useCallback(() => ({ status: 'loading' }), [])
      )
      const snapStatus = snapshot?.status || 'loading'
      const stored = snapshot?.value || {}
      const [schedDraft, setSchedDraft] = React.useState(null)
      const [schedMsg, setSchedMsg] = React.useState('')
      const [schedErr, setSchedErr] = React.useState('')

      React.useEffect(() => {
        if (snapStatus === 'ready' && schedDraft === null) {
          setSchedDraft({ scheduleEnabled: stored.scheduleEnabled ?? false, intervalMinutes: stored.intervalMinutes ?? 60, autoApply: stored.autoApply ?? false })
        }
      }, [snapStatus, stored, schedDraft])

      const saveScheduler = async () => {
        if (!scope || !schedDraft) return
        setBusy(true); setSchedErr(''); setSchedMsg('')
        try {
          await scope.set('scheduleEnabled', !!schedDraft.scheduleEnabled)
          await scope.set('intervalMinutes', Number(schedDraft.intervalMinutes) || 60)
          await scope.set('autoApply', !!schedDraft.autoApply)
          setSchedMsg(t.schedulerSaved)
          load()
        } catch (e) {
          setSchedErr(String(e?.message ?? e))
        } finally {
          setBusy(false)
        }
      }

      const doTry = (targetProvider, targetModel) => {
        const key = `${targetProvider}:${targetModel}`
        setTryState((current) => ({ ...current, [key]: { loading: true } }))
        fetch(`${API}/try`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: targetProvider, model: targetModel }) })
          .then(async (r) => { const b = await r.json(); return { ok: r.ok && b.ok !== false, latency: b.latencyMs, status: b.status, error: b.error } })
          .then((res) => { setTryState((current) => ({ ...current, [key]: { loading: false, ok: res.ok, latency: res.latency, status: res.status, error: res.error } })) })
          .catch((err) => { setTryState((current) => ({ ...current, [key]: { loading: false, ok: false, error: String(err?.message ?? err) } })) })
      }

      const runBatchTry = () => {
        if (!selectionProvider || !selectionDraft.length) return
        setBatchTrying(true)
        setError('')
        fetch(`${API}/batch-try`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ provider: selectionProvider, models: selectionDraft }),
        })
          .then(async (r) => {
            const data = await r.json()
            if (!r.ok || data.error) throw new Error(data?.error?.message ?? `HTTP ${r.status}`)
            return data
          })
          .then((data) => {
            const next = { ...tryState }
            for (const res of data.results ?? []) {
              next[`${selectionProvider}:${res.model}`] = {
                ok: res.ok,
                latency: res.latencyMs,
                status: res.status,
                error: res.error,
                loading: false,
              }
            }
            setTryState(next)
            setBatchSummary(data.summary)
          })
          .catch((e) => setError(String(e?.message ?? e)))
          .finally(() => setBatchTrying(false))
      }

      const deselectUnreachable = () => {
        if (!selectionProvider) return
        setSelectionDraft((current) => current.filter((m) => {
          const probe = tryState[`${selectionProvider}:${m}`]
          return !probe || probe.ok !== false
        }))
      }

      const handleExport = () => {
        fetch(`${API}/export`)
          .then((r) => r.json())
          .then((data) => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `dsh-model-sync-config-${new Date().toISOString().slice(0, 10)}.json`
            a.click()
            URL.revokeObjectURL(url)
          })
          .catch((e) => setError(String(e?.message ?? e)))
      }

      const handleImport = () => {
        if (!importText.trim()) return
        setBusy(true); setImportErr(''); setImportMsg('')
        try {
          const parsed = JSON.parse(importText)
          fetch(`${API}/import`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(parsed),
          })
            .then(async (r) => {
              const res = await r.json()
              if (!r.ok) throw new Error(res.error?.message ?? `HTTP ${r.status}`)
              return res
            })
            .then(() => {
              setImportMsg(t.importSuccess)
              setImportText('')
              setShowImportBox(false)
              load()
            })
            .catch((e) => setImportErr(t.importError.replace('%s', String(e?.message ?? e))))
            .finally(() => setBusy(false))
        } catch {
          setImportErr(t.importError.replace('%s', 'Invalid JSON syntax'))
          setBusy(false)
        }
      }

      const saveAlias = () => {
        if (!aliasDraft.alias.trim() || !aliasDraft.provider || !aliasDraft.model.trim()) return
        setBusy(true); setAliasErr(''); setAliasMsg('')
        fetch(`${API}/aliases`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ alias: aliasDraft.alias.trim(), provider: aliasDraft.provider, model: aliasDraft.model.trim() }),
        })
          .then(async (r) => {
            const res = await r.json()
            if (!r.ok) throw new Error(res.error?.message ?? `HTTP ${r.status}`)
            return res
          })
          .then(() => {
            setAliasDraft({ alias: '', provider: '', model: '' })
            setAliasMsg(t.schedulerSaved)
            load()
          })
          .catch((e) => setAliasErr(String(e?.message ?? e)))
          .finally(() => setBusy(false))
      }

      const deleteAlias = (aliasName) => {
        setBusy(true)
        fetch(`${API}/aliases`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ alias: aliasName, action: 'delete' }),
        })
          .then(async (r) => {
            const res = await r.json()
            if (!r.ok) throw new Error(res.error?.message ?? `HTTP ${r.status}`)
            return res
          })
          .then(() => load())
          .catch((e) => setError(String(e?.message ?? e)))
          .finally(() => setBusy(false))
      }

      const load = () => {
        if (typeof document !== 'undefined' && document.hidden) return
        setError('')
        fetch(`${API}/status`)
          .then((r) => r.json())
          .then(setStatus)
          .catch((e) => setError(String(e?.message ?? e)))
        loadCredentials()
      }

      const loadCredentials = () => {
        fetch(`${API}/credentials`)
          .then((r) => r.json())
          .then(setCredentialStatus)
          .catch(() => {})
      }

      React.useEffect(() => { ensureStyles(); load() }, [])

      const execute = (targetProvider) => {
        setBusy(true); setError(''); setPreview(null)
        fetch(`${API}/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: targetProvider, dryRun, removeMissing }) })
          .then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body?.error?.message ?? `HTTP ${r.status}`); return body })
          .then((body) => {
            setStatus(body)
            if (dryRun && body.results) setPreview(body.results)
            else setPreview(null)
          })
          .catch((e) => setError(String(e?.message ?? e)))
          .finally(() => setBusy(false))
      }

      const checkHealth = (targetProvider) => {
        setBusy(true); setError('')
        fetch(`${API}/health`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: targetProvider }) })
          .then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body?.error?.message ?? `HTTP ${r.status}`); return body })
          .then(setStatus)
          .catch((e) => setError(String(e?.message ?? e)))
          .finally(() => setBusy(false))
      }

      const checkCredentials = (targetProvider) => {
        setBusy(true); setError('')
        fetch(`${API}/credentials/check`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: targetProvider }) })
          .then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body?.error?.message ?? `HTTP ${r.status}`); return body })
          .then((body) => { if (body.credentials) setCredentialStatus(body.credentials); load() })
          .catch((e) => setError(String(e?.message ?? e)))
          .finally(() => setBusy(false))
      }

      const updateNotification = (id, action) => {
        setBusy(true); setError('')
        fetch(`${API}/notifications/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) })
          .then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body?.error?.message ?? `HTTP ${r.status}`); return body })
          .then(() => load())
          .catch((e) => setError(String(e?.message ?? e)))
          .finally(() => setBusy(false))
      }

      const openSelection = (row) => {
        const available = row.availableModels ?? row.models ?? []
        const defaults = row.selectableModels ?? available
        closePolicy()
        setSelectionProvider(row.provider)
        setSelectionDraft(row.selectedModels?.length ? row.selectedModels : defaults.map((model) => model.id))
        setCapabilityFilter([])
        setSearchQuery('')
        setSortBy('name')
        setPageSize(50)
        setQuickFilter({ context100k: false, cheap: false })
        setBatchSummary(null)
      }

      const closeSelection = () => {
        setSelectionProvider('')
        setSelectionDraft([])
        setCapabilityFilter([])
        setSearchQuery('')
        setSortBy('name')
        setPageSize(50)
        setQuickFilter({ context100k: false, cheap: false })
        setBatchSummary(null)
      }

      const openPolicy = (row) => {
        const policy = status?.policies?.[row.provider] ?? row.policy ?? {}
        closeSelection()
        setPolicyProvider(row.provider)
        setPolicyDraft({
          include: (policy.include ?? []).join('\n'),
          exclude: (policy.exclude ?? []).join('\n'),
          requireCapabilities: Object.keys(policy.requireCapabilities ?? {}).join(', '),
          denyCapabilities: Object.keys(policy.denyCapabilities ?? {}).join(', '),
          enableCostFilter: !!policy.enableCostFilter,
          maxPricePerMillion: policy.maxPricePerMillion !== undefined ? String(policy.maxPricePerMillion) : '',
          enableContextFilter: !!policy.enableContextFilter,
          minContextTokens: policy.minContextTokens !== undefined ? String(policy.minContextTokens) : '',
        })
      }

      const closePolicy = () => {
        setPolicyProvider('')
        setPolicyDraft({
          include: '',
          exclude: '',
          requireCapabilities: '',
          denyCapabilities: '',
          enableCostFilter: false,
          maxPricePerMillion: '',
          enableContextFilter: false,
          minContextTokens: '',
        })
      }

      const splitValues = (value) => [...new Set(String(value ?? '').split(/[,\n]+/).map((item) => item.trim()).filter(Boolean))]
      const capabilityValues = (value) => Object.fromEntries(splitValues(value).map((key) => [key, true]))
      const validatePatterns = (patterns) => {
        for (const p of patterns) {
          try { new RegExp(p, 'i') } catch { return p }
        }
        return null
      }

      const savePolicy = () => {
        const includeList = splitValues(policyDraft.include)
        const excludeList = splitValues(policyDraft.exclude)
        const badInclude = validatePatterns(includeList)
        if (badInclude) { setError((t.invalidPattern || 'Invalid regex pattern: %s').replace('%s', badInclude)); return }
        const badExclude = validatePatterns(excludeList)
        if (badExclude) { setError((t.invalidPattern || 'Invalid regex pattern: %s').replace('%s', badExclude)); return }
        setBusy(true); setError('')
        const payload = {
          provider: policyProvider,
          include: includeList,
          exclude: excludeList,
          requireCapabilities: capabilityValues(policyDraft.requireCapabilities),
          denyCapabilities: capabilityValues(policyDraft.denyCapabilities),
          enableCostFilter: !!policyDraft.enableCostFilter,
          ...(policyDraft.enableCostFilter && policyDraft.maxPricePerMillion !== '' ? { maxPricePerMillion: Number(policyDraft.maxPricePerMillion) } : {}),
          enableContextFilter: !!policyDraft.enableContextFilter,
          ...(policyDraft.enableContextFilter && policyDraft.minContextTokens !== '' ? { minContextTokens: Number(policyDraft.minContextTokens) } : {}),
        }
        fetch(`${API}/policy`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
          .then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body?.error?.message ?? `HTTP ${r.status}`); return body })
          .then(() => { closePolicy(); return load() })
          .catch((e) => setError(String(e?.message ?? e)))
          .finally(() => setBusy(false))
      }

      const saveSelection = () => {
        const row = rows.find((item) => item.provider === selectionProvider)
        const available = row?.availableModels ?? row?.models ?? []
        if (available.length > 0 && selectionDraft.length === 0) { setError(t.selectAtLeastOne); return }
        const models = selectionDraft.length === available.length ? [] : selectionDraft
        setBusy(true); setError('')
        fetch(`${API}/selection`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ provider: selectionProvider, models }),
        })
          .then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body?.error?.message ?? `HTTP ${r.status}`); return body })
          .then((body) => { setStatus(body); closeSelection() })
          .catch((e) => setError(String(e?.message ?? e)))
          .finally(() => setBusy(false))
      }

      const rollback = (entry, targetProvider) => {
        if (!window.confirm(t.rollbackConfirm)) return
        setBusy(true); setError('')
        fetch(`${API}/history/rollback`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ historyId: entry.id, provider: targetProvider }),
        })
          .then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body?.error?.message ?? `HTTP ${r.status}`); return body })
          .then(() => load())
          .catch((e) => setError(String(e?.message ?? e)))
          .finally(() => setBusy(false))
      }

      const isNewModel = (model, row) => {
        const added = status?.lastRun?.results?.find((r) => r.provider === row.provider)?.diff?.added || []
        const isAdded = added.some((m) => m.id === model.id)
        if (!isAdded) return false
        const finishedAt = status?.lastRun?.finishedAt
        if (!finishedAt) return false
        return (Date.now() - new Date(finishedAt).getTime()) < 7 * 24 * 60 * 60 * 1000
      }

      const rows = (status?.providers ?? []).filter((row) => row.configured)
      const selectedRow = rows.find((row) => row.provider === selectionProvider)
      const choices = selectedRow?.availableModels ?? selectedRow?.models ?? []

      const filteredChoices = React.useMemo(() => {
        const filteredChoicesBase = filterModelsByCapabilities(choices, capabilityFilter)
        const tokens = debouncedSearchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
        const searchedChoices = tokens.length ? filteredChoicesBase.filter((m) => {
          const haystack = (m.id + ' ' + (m.name || '') + ' ' + (m.aliases || []).join(' ') + ' ' + (m.tags || []).join(' ') + ' ' + (m.description || '')).toLowerCase()
          return tokens.every((tok) => haystack.includes(tok))
        }) : filteredChoicesBase
        const quickFilteredChoices = searchedChoices.filter((m) => {
          if (quickFilter.context100k && (!m.contextWindow || m.contextWindow < 100000)) return false
          if (quickFilter.cheap && (!m.pricing?.inputPerToken || (m.pricing.inputPerToken * 1000000) > 1.0)) return false
          return true
        })
        return [...quickFilteredChoices].sort((a, b) => {
          if (sortBy === 'price') {
            const pa = a.pricing?.inputPerToken ?? Infinity
            const pb = b.pricing?.inputPerToken ?? Infinity
            return pa - pb
          }
          if (sortBy === 'context') return (b.contextWindow ?? 0) - (a.contextWindow ?? 0)
          if (sortBy === 'date') return (b.firstSeenAt ?? 0) - (a.firstSeenAt ?? 0)
          return (a.name || a.id || '').localeCompare(b.name || b.id || '')
        })
      }, [choices, capabilityFilter, debouncedSearchQuery, quickFilter, sortBy])

      const maxContext = React.useMemo(() => filteredChoices.reduce((max, m) => Math.max(max, m.contextWindow || 0), 0), [filteredChoices])
      const minPrice = React.useMemo(() => filteredChoices.reduce((min, m) => m.pricing?.inputPerToken !== undefined ? Math.min(min, m.pricing.inputPerToken) : min, Infinity), [filteredChoices])
      const availableCapabilities = [...new Set(choices.flatMap((model) => Object.entries(model?.capabilities ?? {}).filter(([, enabled]) => enabled === true).map(([key]) => key)))].sort()
      const visibleChoices = filteredChoices.slice(0, pageSize)
      const button = (label, onClick, variant) => React.createElement('button', { type: 'button', disabled: busy, onClick, className: 'dms-btn' + (variant ? ' dms-btn-' + variant : '') }, label)

      const renderNotifications = () => {
        const entries = status?.notifications ?? []
        if (entries.length === 0) return React.createElement('small', { style: { display: 'block', marginTop: 6 } }, t.noNotifications)
        return entries.map((item) => React.createElement('div', { key: item.id, style: { marginTop: 6 } },
          React.createElement('span', null, item.title + ': ' + item.message + ' · ' + (item.occurrences ?? 1) + '×'),
          item.readAt ? null : button(t.markRead, () => updateNotification(item.id, 'read')),
          item.acknowledgedAt ? null : button(t.acknowledge, () => updateNotification(item.id, 'acknowledge')),
          React.createElement('small', { style: { display: 'block', marginLeft: 12 } }, (item.providers ?? []).map((row) => row.provider + ': ' + row.status + (row.message ? ' · ' + row.message : '')).join('; '))))
      }

      const renderScheduler = () => {
        return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%' } },
          status?.scheduler ? React.createElement('small', { style: { display: 'block' } }, `${t.scheduler}: ${status.scheduler.active ? t.schedulerOn : t.schedulerOff}${status.scheduler.nextRunAt ? ` · ${t.nextRun}: ${new Date(status.scheduler.nextRunAt).toLocaleString()}` : ''}`) : null,
          snapStatus === 'loading' ? React.createElement('small', null, t.loading) : null,
          snapStatus === 'unavailable' ? React.createElement('small', { style: { color: 'var(--dsw-alias-label-secondary)' } }, t.scopeUnavailable) : null,
          schedDraft ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 } },
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, cursor: 'pointer' } }, React.createElement('input', { type: 'checkbox', checked: !!schedDraft.scheduleEnabled, onChange: (e) => setSchedDraft((d) => ({ ...d, scheduleEnabled: e.target.checked })), disabled: busy }), t.scheduleEnabled),
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 } }, React.createElement('span', { style: { minWidth: 140 } }, t.intervalMinutes + ':'), React.createElement('input', { type: 'number', min: 1, max: 1440, value: schedDraft.intervalMinutes, onChange: (e) => setSchedDraft((d) => ({ ...d, intervalMinutes: Math.max(1, Number(e.target.value) || 1) })), disabled: busy, style: { width: 90, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-2)', color: 'inherit' } })),
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, cursor: 'pointer' } }, React.createElement('input', { type: 'checkbox', checked: !!schedDraft.autoApply, onChange: (e) => setSchedDraft((d) => ({ ...d, autoApply: e.target.checked })), disabled: busy }), t.autoApplySchedule),
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 } }, button(t.saveScheduler, saveScheduler, 'primary'), schedMsg ? React.createElement('small', { style: { color: 'var(--dsw-alias-state-success-primary)' } }, schedMsg) : null, schedErr ? React.createElement('small', { style: { color: 'var(--dsw-alias-state-error-primary)' } }, schedErr) : null)
          ) : null
        )
      }

      const renderAliases = () => {
        const aliasMap = status?.aliases ?? {}
        const entries = Object.entries(aliasMap)
        return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%' } },
          entries.length === 0 ? React.createElement('small', { style: { display: 'block', marginTop: 4 } }, t.noAliases) : entries.map(([aliasName, data]) => {
            return React.createElement('div', { key: aliasName, className: 'dms-row', style: { justifyContent: 'space-between', padding: '6px 10px', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, background: 'var(--dsw-alias-bg-layer-2)' } },
              React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
                React.createElement('strong', { style: { fontFamily: 'monospace', fontSize: 13 } }, aliasName),
                React.createElement('span', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12 } }, `→ ${data.provider} / ${data.model}`)
              ),
              button(t.removeAlias, () => deleteAlias(aliasName), 'danger')
            )
          }),
          React.createElement('div', { className: 'dms-row', style: { marginTop: 8, gap: 8 } },
            React.createElement('input', {
              className: 'dms-input',
              placeholder: t.aliasPlaceholder,
              value: aliasDraft.alias,
              onChange: (e) => setAliasDraft((d) => ({ ...d, alias: e.target.value })),
              style: { flex: '1 1 140px' }
            }),
            React.createElement('select', {
              className: 'dms-input',
              value: aliasDraft.provider,
              onChange: (e) => setAliasDraft((d) => ({ ...d, provider: e.target.value, model: '' })),
              style: { flex: '1 1 120px' }
            },
              React.createElement('option', { value: '' }, `-- ${t.targetProvider} --`),
              rows.map((r) => React.createElement('option', { key: r.provider, value: r.provider }, r.provider))
            ),
            React.createElement('input', {
              className: 'dms-input',
              placeholder: t.targetModel,
              value: aliasDraft.model,
              onChange: (e) => setAliasDraft((d) => ({ ...d, model: e.target.value })),
              style: { flex: '1 1 140px' }
            }),
            button(t.addAlias, saveAlias, 'primary')
          ),
          aliasMsg ? React.createElement('small', { style: { color: 'var(--dsw-alias-state-success-primary)' } }, aliasMsg) : null,
          aliasErr ? React.createElement('small', { style: { color: 'var(--dsw-alias-state-error-primary)' } }, aliasErr) : null
        )
      }

      const renderExportImport = () => {
        return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%' } },
          React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } },
            button(t.exportConfig, handleExport),
            button(t.importConfig, () => setShowImportBox((v) => !v)),
            importMsg ? React.createElement('small', { style: { color: 'var(--dsw-alias-state-success-primary)' } }, importMsg) : null,
            importErr ? React.createElement('small', { style: { color: 'var(--dsw-alias-state-error-primary)' } }, importErr) : null
          ),
          showImportBox ? React.createElement('div', { className: 'dms-editor', style: { marginTop: 6 } },
            React.createElement('textarea', {
              rows: 4,
              value: importText,
              onChange: (e) => setImportText(e.target.value),
              placeholder: t.importPlaceholder,
              style: { width: '100%', fontFamily: 'monospace', fontSize: 12 }
            }),
            React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 6 } },
              button(t.apply, handleImport, 'primary'),
              button(t.cancel, () => { setShowImportBox(false); setImportErr('') })
            )
          ) : null
        )
      }

      const renderHistory = () => {
        const entries = status?.history ?? []
        if (entries.length === 0) return React.createElement('small', { style: { display: 'block', marginTop: 6 } }, t.noHistory)
        return entries.map((entry) => React.createElement('details', { key: entry.id, style: { marginTop: 6 } },
          React.createElement('summary', null, `${t.historyRun} #${entry.version} · ${new Date(entry.finishedAt).toLocaleString()}`),
          (entry.providers ?? []).map((item) => {
            const counts = item.counts ?? {}
            const names = (items) => (items ?? []).map((model) => model?.after?.id ?? model?.id).filter(Boolean).join(', ')
            const details = `+ ${names(item.diff?.added)}; - ${names(item.diff?.removed)}; ⇄ ${(item.diff?.renamed ?? []).map((pair) => `${pair.before?.id} → ${pair.after?.id}`).join(', ')}; ~ ${(item.diff?.changed ?? []).map((pair) => pair.after?.id).join(', ')}`
            return React.createElement('div', { key: item.provider, style: { margin: '6px 0 6px 12px' } },
              React.createElement('span', null, `${item.provider}: ${item.status} · +${counts.added ?? 0} ${t.diffAdded}, -${counts.removed ?? 0} ${t.diffRemoved}, ${counts.renamed ?? 0} ${t.diffRenamed}, ${counts.changed ?? 0} ${t.diffChanged}`),
              item.hasRollback ? button(t.rollback, () => rollback(entry, item.provider), 'danger') : null,
              React.createElement('small', { style: { display: 'block', marginTop: 4 } }, details))
          })))
      }

      return React.createElement('div', { className: 'dms-wrap' },
        includeIntro ? React.createElement('p', null, t.desc) : null,
        React.createElement('div', { className: 'dms-toolbar' },
          React.createElement('select', { value: provider, onChange: (e) => setProvider(e.target.value) },
            React.createElement('option', { value: '' }, t.all),
            rows.map((row) => React.createElement('option', { key: row.provider, value: row.provider }, row.provider))
          ),
          React.createElement('label', { style: { marginLeft: 12 } }, React.createElement('input', { type: 'checkbox', checked: dryRun, onChange: (e) => setDryRun(e.target.checked) }), ` ${t.dryRun}`),
          React.createElement('label', { style: { marginLeft: 12 } }, React.createElement('input', { type: 'checkbox', checked: removeMissing, onChange: (e) => setRemoveMissing(e.target.checked) }), ` ${t.removeMissing}`)
        ),
        React.createElement('div', { className: 'dms-actions' },
          button(t.refresh, load),
          button(t.refreshAll, () => execute(undefined)),
          button(dryRun ? t.run : t.apply, () => execute(provider || undefined), dryRun ? undefined : 'primary'),
          button(t.health, () => checkHealth(provider || undefined)),
          button(t.checkCredentials, () => checkCredentials(provider || undefined))
        ),
        busy ? React.createElement('span', null, t.running) : null,
        error ? React.createElement('div', { className: 'dms-alert dms-alert-bad' }, error) : null,
        preview ? React.createElement('div', { className: 'dms-editor' },
          React.createElement('strong', null, t.previewTitle),
          preview.length === 0 ? React.createElement('small', null, t.previewNone) : preview.map((item) => {
            const counts = item.counts ?? {}
            const names = (items) => (items ?? []).map((model) => model?.after?.id ?? model?.id).filter(Boolean).join(', ')
            const details = `+ ${names(item.diff?.added)}; - ${names(item.diff?.removed)}; ⇄ ${(item.diff?.renamed ?? []).map((pair) => `${pair.before?.id} → ${pair.after?.id}`).join(', ')}; ~ ${(item.diff?.changed ?? []).map((pair) => pair.after?.id).join(', ')}`
            return React.createElement('div', { key: item.provider, style: { margin: '4px 0' } },
              React.createElement('span', null, `${item.provider}: ${item.status} · +${counts.added ?? 0} ${t.previewAdded}, -${counts.removed ?? 0} ${t.previewRemoved}, ${counts.changed ?? 0} ${t.previewChanged}`),
              React.createElement('small', { style: { display: 'block', marginLeft: 8 } }, details)
            )
          }),
          React.createElement('div', { style: { marginTop: 8 } },
            button(t.previewApply, () => execute(provider || undefined), 'primary'),
            button(t.previewDismiss, () => setPreview(null))
          )
        ) : null,
        status?.lastRun ? React.createElement('small', null, `${t.lastRun}: ${new Date(status.lastRun.finishedAt).toLocaleString()}`) : null,
        rows.length === 0 ? React.createElement('p', null, t.noProviders) : rows.map((row) => {
          const latestRun = status?.lastRun?.results?.find((item) => item.provider === row.provider)
          const addedCount = latestRun?.status === 'ok' ? (latestRun.diff?.added?.length ?? 0) : 0
          const count = row.models?.length ?? 0
          const availableCount = row.availableModels?.length ?? count
          const staleCount = row.staleModels?.length ?? 0
          const deprecatedCount = row.deprecatedModels?.length ?? 0
          const cachedHours = row.cachedAt ? Math.round((Date.now() - new Date(row.cachedAt).getTime()) / 3600000) : null
          const isStaleDiscovery = row.staleDiscovery === true
          const metaBadges = []
          if (cachedHours !== null) metaBadges.push(t.cacheHoursAgo.replace('%d', cachedHours))
          if (staleCount > 0) metaBadges.push(`${staleCount} ${t.stale}`)
          if (deprecatedCount > 0) metaBadges.push(`${deprecatedCount} ${t.deprecated}`)
          const modelSummary = count === availableCount ? `${count} ${t.selected}` : `${count}/${availableCount} ${t.selected}`
          const healthBadge = row.health?.status ? React.createElement('span', { className: 'dms-badge ' + (row.health.status === 'ok' ? 'dms-badge-ok' : row.health.status === 'dormant' ? 'dms-badge-warn' : 'dms-badge-bad') }, row.health.status === 'ok' ? t.healthOk : row.health.status === 'dormant' ? t.healthDormant : t.healthError) : null
          const staleBadge = isStaleDiscovery ? React.createElement('span', { className: 'dms-badge dms-badge-warn' }, t.stale) : null
          const providerCard = React.createElement('div', { key: row.provider, className: 'dms-provider' },
            React.createElement('span', null,
              React.createElement('strong', null, row.provider),
              ` · ${row.configured ? t.ok : t.dormant} · ${modelSummary}`,
              metaBadges.length ? ` · ${metaBadges.join(' · ')}` : '',
              ' ', healthBadge, ' ', staleBadge
            ),
            button(t.selectModels, () => openSelection(row)),
            button(t.policy, () => openPolicy(row))
          )

          const selectionEditor = selectionProvider === row.provider ? React.createElement('div', { className: 'dms-editor' },
            React.createElement('strong', null, `${t.selectModels}: ${selectionProvider}`),
            React.createElement('div', { style: { display: 'flex', gap: 8, margin: '8px 0', flexWrap: 'wrap' } },
              React.createElement('input', { placeholder: t.searchPlaceholder, value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), style: { flex: '1 1 160px', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-2)' } }),
              React.createElement('select', { value: sortBy, onChange: (e) => setSortBy(e.target.value), style: { padding: '6px 8px', borderRadius: 6 } },
                React.createElement('option', { value: 'name' }, t.sortName),
                React.createElement('option', { value: 'price' }, t.sortPrice),
                React.createElement('option', { value: 'context' }, t.sortContext),
                React.createElement('option', { value: 'date' }, t.sortDate)
              )
            ),
            React.createElement('div', { style: { display: 'flex', gap: 6, margin: '6px 0', flexWrap: 'wrap' } },
              React.createElement('button', { type: 'button', className: 'dms-btn', style: quickFilter.context100k ? { borderColor: 'var(--dsw-alias-brand-primary)', background: 'var(--dsw-alias-bg-layer-2)' } : {}, onClick: () => setQuickFilter((f) => ({ ...f, context100k: !f.context100k })) }, (quickFilter.context100k ? '✓ ' : '') + t.filterContext100k),
              React.createElement('button', { type: 'button', className: 'dms-btn', style: quickFilter.cheap ? { borderColor: 'var(--dsw-alias-brand-primary)', background: 'var(--dsw-alias-bg-layer-2)' } : {}, onClick: () => setQuickFilter((f) => ({ ...f, cheap: !f.cheap })) }, (quickFilter.cheap ? '✓ ' : '') + t.filterCheap)
            ),
            React.createElement('div', { style: { margin: '8px 0' } },
              choices.length === 0 ? React.createElement('small', null, t.noModels) : React.createElement(React.Fragment, null,
                availableCapabilities.length > 0 ? React.createElement('div', { style: { marginBottom: 8 } },
                  React.createElement('strong', null, t.capabilityFilter),
                  availableCapabilities.map((capability) => React.createElement('label', { key: capability, style: { display: 'inline-block', marginLeft: 8 } },
                    React.createElement('input', { type: 'checkbox', checked: capabilityFilter.includes(capability), onChange: (e) => setCapabilityFilter((current) => e.target.checked ? [...current, capability] : current.filter((item) => item !== capability)) }),
                    ' ' + (CAPABILITY_LABELS[capability]?.[locale] ?? capability)
                  ))
                ) : React.createElement('small', { style: { display: 'block', marginBottom: 8 } }, t.noCapabilities),
                React.createElement('div', { style: { display: 'flex', gap: 6, margin: '6px 0', flexWrap: 'wrap' } },
                  button(t.selectAllFiltered, () => { const ids = new Set(selectionDraft); for (const m of filteredChoices) ids.add(m.id); setSelectionDraft([...ids]) }),
                  button(t.deselectAllFiltered, () => { const filterSet = new Set(filteredChoices.map((m) => m.id)); setSelectionDraft(selectionDraft.filter((id) => !filterSet.has(id))) }),
                  button(t.invertFiltered, () => { const current = new Set(selectionDraft); for (const m of filteredChoices) { if (current.has(m.id)) current.delete(m.id); else current.add(m.id); } setSelectionDraft([...current]) })
                ),
                React.createElement('div', { style: { display: 'flex', gap: 6, margin: '6px 0', flexWrap: 'wrap', alignItems: 'center' } },
                  button(batchTrying ? t.batchTryRunning : t.batchTry, runBatchTry),
                  batchSummary && batchSummary.unreachable > 0 ? button(t.batchTryDeselectUnreachable, deselectUnreachable, 'danger') : null,
                  batchSummary ? React.createElement('small', { style: { color: 'var(--dsw-alias-label-secondary)' } }, t.batchTryResults.replace('%d', batchSummary.reachable).replace('%d', batchSummary.total)) : null
                ),
                React.createElement('small', { style: { display: 'block', marginBottom: 8 } }, `${filteredChoices.length}/${choices.length} ${t.capabilityCount}`),
                visibleChoices.map((model) => {
                  const deprecationDays = (() => {
                    const d = model.lifecycle?.deprecationDate
                    if (!d) return null
                    const diff = new Date(d).getTime() - Date.now()
                    return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0
                  })()
                  const probe = tryState[`${row.provider}:${model.id}`]
                  return React.createElement('label', { key: model.id, style: { display: 'block', margin: '4px 0', padding: '4px 6px', borderRadius: 6, background: isNewModel(model, row) ? 'var(--dsw-alias-bg-layer-2)' : 'transparent' } },
                    React.createElement('input', { type: 'checkbox', checked: selectionDraft.includes(model.id), onChange: (e) => setSelectionDraft((current) => e.target.checked ? [...current, model.id] : current.filter((id) => id !== model.id)) }),
                    ` ${model.name ?? model.id} (${model.id})`,
                    isNewModel(model, row) ? React.createElement('span', { style: { marginLeft: 6, fontSize: 11, padding: '1px 5px', borderRadius: 4, background: 'var(--dsw-alias-state-business-primary)', color: 'white' } }, 'NEW') : null,
                    deprecationDays !== null ? React.createElement('span', { style: { marginLeft: 6, fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'var(--dsw-alias-state-warning-primary)', color: 'white' } }, deprecationDays > 0 ? t.deprecatesIn.replace('%d', deprecationDays) : t.deprecated) : null,
                    (model.contextWindow && maxContext > 0 && model.contextWindow >= maxContext) ? React.createElement('span', { style: { marginLeft: 4, fontSize: 10, padding: '1px 4px', borderRadius: 3, background: 'var(--dsw-alias-state-warning-primary)', color: 'white' } }, '★') : null,
                    (model.pricing && minPrice !== Infinity && model.pricing.inputPerToken === minPrice) ? React.createElement('span', { style: { marginLeft: 4, fontSize: 10, padding: '1px 4px', borderRadius: 3, background: 'var(--dsw-alias-state-success-primary)', color: 'white' } }, '$') : null,
                    model.tags && model.tags.length ? React.createElement('small', { style: { marginLeft: 6, color: 'var(--dsw-alias-label-secondary)' } }, model.tags.join(', ')) : null,
                    model.pricing ? React.createElement('small', { style: { marginLeft: 6, color: 'var(--dsw-alias-label-secondary)', fontSize: 11 } }, `in $${(model.pricing.inputPerToken * 1000000).toFixed(2)}/1M` + (model.pricing.cacheReadPerToken !== undefined ? ` / cache $${(model.pricing.cacheReadPerToken * 1000000).toFixed(2)}` : '') + (model.pricing.outputPerToken !== undefined ? ` / out $${(model.pricing.outputPerToken * 1000000).toFixed(2)}` : '')) : null,
                    model.description ? React.createElement('small', { title: model.description, style: { display: 'block', marginLeft: 22, color: 'var(--dsw-alias-label-secondary)', fontSize: 11 } }, model.description.slice(0, 120)) : null,
                    row.baseURL || row.api ? React.createElement('a', { href: (row.baseURL || '') + '/models/' + encodeURIComponent(model.id), target: '_blank', rel: 'noopener', style: { marginLeft: 8, fontSize: 11 } }, 'docs') : null,
                    React.createElement('button', { type: 'button', onClick: (e) => { e.preventDefault(); doTry(row.provider, model.id) }, style: { marginLeft: 8, fontSize: 11, padding: '1px 6px', borderRadius: 4 } }, (probe && probe.loading) ? '…' : '▶'),
                    probe && !probe.loading ? React.createElement('span', { className: 'dms-badge ' + (probe.ok ? 'dms-badge-ok' : 'dms-badge-bad'), style: { marginLeft: 6 } }, probe.ok ? `${probe.latency}ms` : (probe.error || probe.status || 'offline')) : null
                  )
                }),
                filteredChoices.length > pageSize ? React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' } },
                  button(t.showMore.replace('%d', Math.min(50, filteredChoices.length - pageSize)), () => setPageSize((s) => s + 50)),
                  React.createElement('small', { style: { color: 'var(--dsw-alias-label-secondary)' } }, t.showingCount.replace('%d', visibleChoices.length).replace('%d', filteredChoices.length))
                ) : null
              )
            ),
            React.createElement('small', null, t.pickerNote),
            React.createElement('div', { style: { marginTop: 8 } },
              button(t.allModels, () => setSelectionDraft(choices.map((model) => model.id))),
              button(t.saveSelection, saveSelection, 'primary'),
              button(t.cancel, closeSelection)
            )
          ) : null

          const policyEditor = policyProvider === row.provider ? React.createElement('div', { className: 'dms-editor' },
            React.createElement('strong', null, `${t.policy}: ${policyProvider}`),
            React.createElement('label', { style: { display: 'block', marginTop: 8 } }, t.policyInclude,
              React.createElement('textarea', { rows: 3, value: policyDraft.include, onChange: (e) => setPolicyDraft((current) => ({ ...current, include: e.target.value })), style: { display: 'block', width: '100%' } })
            ),
            React.createElement('label', { style: { display: 'block', marginTop: 8 } }, t.policyExclude,
              React.createElement('textarea', { rows: 3, value: policyDraft.exclude, onChange: (e) => setPolicyDraft((current) => ({ ...current, exclude: e.target.value })), style: { display: 'block', width: '100%' } })
            ),
            React.createElement('label', { style: { display: 'block', marginTop: 8 } }, t.policyRequire,
              React.createElement('input', { value: policyDraft.requireCapabilities, onChange: (e) => setPolicyDraft((current) => ({ ...current, requireCapabilities: e.target.value })), style: { display: 'block', width: '100%' } })
            ),
            React.createElement('label', { style: { display: 'block', marginTop: 8 } }, t.policyDeny,
              React.createElement('input', { value: policyDraft.denyCapabilities, onChange: (e) => setPolicyDraft((current) => ({ ...current, denyCapabilities: e.target.value })), style: { display: 'block', width: '100%' } })
            ),
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, cursor: 'pointer' } },
              React.createElement('input', { type: 'checkbox', checked: !!policyDraft.enableCostFilter, onChange: (e) => setPolicyDraft((c) => ({ ...c, enableCostFilter: e.target.checked })) }),
              t.enableCostFilter
            ),
            policyDraft.enableCostFilter ? React.createElement('label', { style: { display: 'block', marginTop: 4, marginLeft: 22 } },
              t.maxPricePerMillion,
              React.createElement('input', { type: 'number', step: '0.1', min: '0', value: policyDraft.maxPricePerMillion ?? '', onChange: (e) => setPolicyDraft((c) => ({ ...c, maxPricePerMillion: e.target.value })), style: { display: 'block', width: 140, marginTop: 4 } })
            ) : null,
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, cursor: 'pointer' } },
              React.createElement('input', { type: 'checkbox', checked: !!policyDraft.enableContextFilter, onChange: (e) => setPolicyDraft((c) => ({ ...c, enableContextFilter: e.target.checked })) }),
              t.enableContextFilter
            ),
            policyDraft.enableContextFilter ? React.createElement('label', { style: { display: 'block', marginTop: 4, marginLeft: 22 } },
              t.minContextTokens,
              React.createElement('input', { type: 'number', step: '1000', min: '0', value: policyDraft.minContextTokens ?? '', onChange: (e) => setPolicyDraft((c) => ({ ...c, minContextTokens: e.target.value })), style: { display: 'block', width: 140, marginTop: 4 } })
            ) : null,
            React.createElement('small', null, t.policyNote),
            React.createElement('div', { style: { marginTop: 8 } },
              button(t.savePolicy, savePolicy, 'primary'),
              button(t.cancel, closePolicy)
            )
          ) : null

          return React.createElement('div', { key: row.provider, className: 'dms-provider-wrap' }, providerCard, selectionEditor, policyEditor)
        }),
        React.createElement('div', { className: 'dms-section-card dms-section' },
          React.createElement('div', { className: 'dms-section-title' }, React.createElement('strong', null, t.modelAliases)),
          renderAliases()
        ),
        React.createElement('div', { className: 'dms-section-card dms-section' },
          React.createElement('div', { className: 'dms-section-title' }, React.createElement('strong', null, t.exportImportTitle)),
          renderExportImport()
        ),
        React.createElement('div', { className: 'dms-section-card dms-section' },
          React.createElement('div', { className: 'dms-section-title' }, React.createElement('strong', null, t.notifications)),
          renderNotifications()
        ),
        React.createElement('div', { className: 'dms-section-card dms-section' },
          React.createElement('div', { className: 'dms-section-title' }, React.createElement('strong', null, t.credentials)),
          credentialStatus === null ? React.createElement('small', { style: { display: 'block', marginTop: 6 } }, t.loading) : (credentialStatus.results ?? []).length === 0 ? React.createElement('small', { style: { display: 'block', marginTop: 6 } }, t.noProviders) : (credentialStatus.results ?? []).map((item) => React.createElement('div', { key: item.provider, style: { marginTop: 6 } }, React.createElement('span', null, `${item.provider}: ${item.rotation?.configured ? `${item.rotation.keyCount} refs` : 'single ref'}${item.lastRequest ? ` · ${item.lastRequest.status}` : ''}`), (item.refs ?? []).map((ref) => React.createElement('small', { key: ref.ref || ref.label, style: { display: 'block', marginLeft: 12 } }, `${ref.order}. ${ref.label} · ${ref.configured === true ? t.credentialReady : t.missingCredential}${ref.source && ref.source !== 'unknown' ? ` · ${ref.source}` : ''}${ref.lastResolution?.status ? ` · ${ref.lastResolution.status}` : ''}`))))
        ),
        React.createElement('div', { className: 'dms-section-card dms-section' },
          React.createElement('div', { className: 'dms-section-title' }, React.createElement('strong', null, t.schedulerSettings)),
          renderScheduler()
        ),
        React.createElement('div', { className: 'dms-section-card dms-section' },
          React.createElement('div', { className: 'dms-section-title' }, React.createElement('strong', null, t.history)),
          renderHistory()
        )
      )
    }

    function ModelSyncCard({ ctx }) {
      const locale = useLocale(ctx)
      const t = locale === 'zh' ? zh : en
      const [open, setOpen] = React.useState(false)
      const [cardStatus, setCardStatus] = React.useState(null)
      React.useEffect(() => {
        ensureStyles()
        const load = () => {
          if (typeof document !== 'undefined' && document.hidden) return
          fetch(`${API}/status`).then((r) => r.json()).then(setCardStatus).catch(() => {})
        }
        load()
        if (open) return
        const id = setInterval(load, 15000)
        return () => clearInterval(id)
      }, [open])
      const cardBadge = (cardStatus?.lastRun?.results?.reduce((s, r) => s + (r.diff?.added?.length || 0), 0) || 0)
      return React.createElement('li', { className: 'dms-card' + (open ? ' dms-card-open' : '') },
        React.createElement('button', { type: 'button', className: 'dms-card-header', 'aria-expanded': open, 'aria-label': `${t[open ? 'hideSettings' : 'showSettings']}: ${t.title}`, onClick: () => setOpen((value) => !value) },
          React.createElement('span', { className: 'dms-card-head-text' },
            React.createElement('span', { className: 'dms-card-name' }, t.title),
            React.createElement('span', { className: 'dms-card-description' }, t.desc)
          ),
          cardBadge ? React.createElement('span', { style: { background: 'var(--dsw-alias-state-business-primary)', color: 'white', padding: '2px 6px', borderRadius: 6, fontSize: 11, marginLeft: 8 } }, `+${cardBadge}`) : null,
          React.createElement('svg', { width: 14, height: 14, className: 'dms-card-chevron' + (open ? ' dms-card-chevron-open' : ''), viewBox: '0 0 14 14', fill: 'none', 'aria-hidden': 'true' },
            React.createElement('path', { d: 'M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5', fill: 'currentColor' })
          )
        ),
        open ? React.createElement('div', { className: 'dms-card-body' }, React.createElement(ErrorBoundary, null, React.createElement(ModelSyncSection, { ctx, includeIntro: false }))) : null
      )
    }

    function apply(ctx) {
      ctx.effect(() => {
        try { ctx.locale?.register?.(NS, { en, zh }) } catch (err) {
          try { console.debug('[dsh-model-sync] locale register best-effort:', err) } catch { /* console unavailable */ }
        }
        return () => {}
      }, 'dsh-model-sync: dictionaries')
      try {
        ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({ name: 'settings.plugin.item', key: NS, locale: NS, inject: () => ({ ctx }) }, (props) => React.createElement(ErrorBoundary, null, React.createElement(ModelSyncCard, { ...props, ctx }))))
      } catch (err) {
        try { console.debug('[dsh-model-sync] slots inject best-effort:', err) } catch { /* console unavailable */ }
      }
    }

    module.exports = { apply, inject: ['slots', 'locale', 'settingsScope'], filterModelsByCapabilities }
    return module.exports
  },
})
