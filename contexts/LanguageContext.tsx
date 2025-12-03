

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'zh';

const translations = {
  en: {
    // General
    appTitle: "LinkW Warehouse System",
    appSubtitle: "Dashboard · Reporting · Import/Export · Role Management",
    dashboard: "Dashboard",
    rulesOps: "Rules & Ops",
    wmsSystem: "WMS System",
    biSystem: "BI Reports",
    signOut: "Sign Out",
    user: "User",
    menu: "MENU",
    syncActive: "Sync Active",
    
    // Login
    loginTitle: "LinkW Warehouse",
    loginSubtitle: "Sign in to access the system",
    username: "Username",
    password: "Password",
    signIn: "Sign In",
    invalidCredentials: "Invalid credentials",
    defaultAccounts: "Default Accounts:",
    
    // Dashboard
    overviewTitle: "Warehouse Overview",
    overviewDesc: "Real-time stats on capacity, utilization, and location types.",
    totalLocations: "Total Locations",
    zones: "A-R Zones",
    palletCapacity: "Pallet Capacity",
    avgUtilization: "Avg Utilization",
    destConstraint: "Dest Constraint",
    locsExceeding: "Locs exceeding max dests",
    summaryByType: "Summary by Type",
    zoneStats: "Zone Statistics",
    topDestinations: "Popular Destinations (by Pallet Count)",
    count: "Count",
    util: "Util",
    palletCount: "Pallets",
    dest: "Dest",
    'Interactive Warehouse Map': "Interactive Warehouse Map",
    
    // BI (Business Intelligence)
    biTitle: "Business Intelligence",
    biDesc: "Advanced analytics, inventory health, and operational metrics.",
    totalInventory: "Total Inventory",
    globalUtilization: "Global Utilization",
    occupiedLocations: "Occupied Locations",
    recentActivity: "Recent Activity",
    zonePerformance: "Zone Performance (Volume & Util)",
    inventoryComposition: "Inventory Composition",
    operationalActivity: "Operational Activity",
    capacityDistribution: "Capacity Distribution",
    utilization: "Utilization",

    // Util Status
    emptyLoad: "Empty",
    lowLoad: "Low Load",
    modLoad: "Moderate",
    highLoad: "High Load",
    critLoad: "Critical / Full",
    normalLoad: "Normal Load",

    // Rules Toolbar
    searchPlaceholder: "Search locations...",
    inventory: "Inventory",
    unload: "Unload",
    plan: "Plan",
    exportPlan: "Export Results",
    exportPlanTooltip: "The exported table is consistent with the imported table in structure, format, and data content.",
    outbound: "Outbound",
    rules: "Rules",
    columnSettings: "Columns",
    manualUnload: "Manual Unload",
    queryContainerHistory: "Query Container History",
    
    // Rules Table
    colRange: "Location",
    colDest: "Destinations",
    colType: "Type",
    colMax: "Max Pallets",
    colCur: "Cur Pallets",
    colCartons: "Cartons",
    colUtil: "Utilization",
    colAllow: "Allow Dest",
    colCurDest: "Cur Dest",
    colStatus: "Status",
    colNote: "Note",
    colActions: "Actions",
    statusOk: "OK",
    statusOverflow: "OVERFLOW",
    
    // Pagination
    prevPage: "Previous",
    nextPage: "Next",
    pageInfo: "Page {current} of {total} ({items} items)",

    // Location Types (V14)
    'amz-main-A': "Amazon Main (A)",
    'amz-main-BC': "Amazon Main (B/C)",
    'amz-buffer': "Amazon Buffer (D/E/G)",
    sehin: "Shein Zone (A)",
    private: "Private (V/G)",
    platform: "Platform (F/H)",
    express: "Express (A)",
    suspense: "Suspense/Transfer",
    highvalue: "High Value (R)",
    
    // WMS
    tabInventory: "Inventory",
    tabInbound: "Inbound",
    tabOutbound: "Outbound",
    tabMaster: "Master Data",
    wmsModule: "Module",
    wmsIntegration: "WMS Integration",
    loadWms: "Load WMS",
    noWmsUrl: "No WMS URL configured.",
    enterWmsUrl: "Enter your WMS system URL below to embed it here.",
    
    // WMS Descriptions
    descInventory: "Check stock levels across zones A/B/C/V/R. Export inventory snapshots.",
    descInbound: "Process container arrivals. Generate putaway tasks based on location rules.",
    descOutbound: "Manage pick lists, verify shipments, and generate BOLs.",
    descMaster: "Configure customers, destinations, and user permissions.",

    // Cloud Sync
    cloudSync: "Cloud Storage",
    cloudDesc: "Sync data with your backend server.",
    cloudSettings: "Connection Settings",
    serverUrl: "Server/API URL",
    urlRequired: "URL is required.",
    settingsSaved: "Settings saved.",
    apiKey: "API Key (Optional)",
    pushToCloud: "Upload Data",
    pullFromCloud: "Download Data",
    syncSuccess: "Data synchronized successfully.",
    syncError: "Synchronization failed.",
    lastSync: "Last Sync:",

    // Modals & Alerts
    cancel: "Cancel",
    selectDestinations: "Select Destinations",
    maxAllowed: "Max Allowed",
    current: "Current",
    done: "Done",
    confirmDelete: "Delete this rule?",
    confirmReset: "Reset to defaults? All changes will be lost.",
    removeTag: "Remove tag",
    importSuccess: "Import successful!",
    unloadSuccess: "Unload plan processed successfully.",
    containerMapImportSuccess: "Container map updated",
    duplicateContainerError: "Container {container} has already been imported.",
    deductedPallets: "Deducted pallets based on outbound sheet.",
    suggestedLocation: "Location Arrangement",
    locationArrangementColumnNotFound: 'Locations assigned, but the "Location Arrangement" column was not found in your Excel file. Please add it to see the arrangement upon export.',
    history: "History",
    noHistory: "No history for this location.",
    updateFromOtherTab: "Data updated from another tab.",
    exceptionAdded: "New exception recorded.",
    uiRefreshed: "UI refreshed with the latest data.",
    locationArrangement: "Location Arrangement",

    // Add Rule
    range: "Location",
    maxPal: "Max Pal",
    allowDest: "Allow",
    note: "Note",

    // Manual Unload
    manualUnloadTitle: "Manual Unload Entry",
    addDestRow: "Add Row",
    processUnload: "Process Unload",

    // Container History Modal
    containerHistoryTitle: "Container History",
    searchContainer: "Search by Container No...",
    containerDetails: "Container Details",
    noContainerFound: "No containers found.",
    noContainerSelected: "Select a container to see details.",

    // Exceptions
    containerNo: "Container No.",
    pcNo: "PC No.",
    description: "Description",
    exceptionsTitle: "Exception Management",
    exceptionsDesc: "Track and manage operational exceptions.",
    addException: "Add Exception",
    record: "Record",
    time: "Time",
    
    // AI Assistant
    assistantTitle: "AI Assistant",
    assistantPlaceholder: "Ask about warehouse status...",

    // Dashboard Customization
    editLayout: "Edit Layout",
    moveUp: "Move Up",
    moveDown: "Move Down",

    // User Management
    userManagement: "User Management",
    manageUsersDesc: "Add, remove, and manage user accounts.",
    addUser: "Add User",
    role: "Role",
    deleteUser: "Delete User",
    confirmDeleteUser: "Are you sure you want to delete this user? This action cannot be undone.",
    userAdded: "User added successfully.",
    userDeleted: "User deleted successfully.",
    userExists: "A user with this username already exists.",
    cannotDeleteSelf: "You cannot delete your own account.",

    // Location Management
    locationManagement: "Location Management",
    locationManagementDesc: "Add or remove warehouse location codes.",
    addLocation: "Add Location",
    deleteLocation: "Delete Location",
    confirmDeleteLocation: "Delete location {locationCode}? This cannot be undone.",
    locationExistsError: "Location {locationCode} already exists.",
    locationNotEmptyError: "Cannot delete {locationCode} because it contains pallets.",
    locationAdded: "Location {locationCode} added successfully.",
    locationDeleted: "Location {locationCode} deleted successfully.",
    addNewLocation: "Add New Location",
    locationCodePlaceholder: "Enter new location code (e.g., A55)",
    existingLocations: "Existing Locations",
  },
  zh: {
    // General
    appTitle: "盈仓科技 · 库位系统",
    appSubtitle: "看板 · 报表 · 导入导出 · 权限管理",
    dashboard: "库位看板",
    rulesOps: "规则与操作",
    wmsSystem: "WMS 系统",
    biSystem: "BI 报表",
    signOut: "退出登录",
    user: "用户",
    menu: "菜单",
    syncActive: "多端同步中",
    
    // Login
    loginTitle: "盈仓科技 · LA 仓库",
    loginSubtitle: "仅内部使用 · 请输入账号密码",
    username: "用户名",
    password: "密码",
    signIn: "登录",
    invalidCredentials: "账号或密码错误",
    defaultAccounts: "默认账号：",
    
    // Dashboard
    overviewTitle: "仓库概览",
    overviewDesc: "实时统计库容、利用率及库位类型分布。",
    totalLocations: "库位总数",
    zones: "A-R 全区",
    palletCapacity: "托盘容量",
    avgUtilization: "平均利用率",
    destConstraint: "目的地约束",
    locsExceeding: "超标库位数量",
    summaryByType: "分类汇总",
    zoneStats: "区域统计数据",
    topDestinations: "热门目的地 (按板数排列)",
    count: "数量",
    util: "利用率",
    palletCount: "板数",
    dest: "目的地",
    'Interactive Warehouse Map': "仓库交互式地图",
    
    // BI (Business Intelligence)
    biTitle: "商业智能 (BI)",
    biDesc: "高级数据分析、库存健康度及运营指标可视化。",
    totalInventory: "总库存量",
    globalUtilization: "整体利用率",
    occupiedLocations: "占用库位",
    recentActivity: "近期活动",
    zonePerformance: "区域绩效 (容积 & 利用率)",
    inventoryComposition: "库存结构分析",
    operationalActivity: "运营活动趋势",
    capacityDistribution: "库位状态分布",
    utilization: "利用率",

    // Util Status
    emptyLoad: "空闲",
    lowLoad: "利用率较低",
    modLoad: "利用率适中",
    highLoad: "利用率较高",
    critLoad: "接近满载 / 爆仓",
    normalLoad: "正常",

    // Rules Toolbar
    searchPlaceholder: "搜索库位、备注...",
    inventory: "盘点单",
    unload: "拆柜单",
    plan: "排位表",
    exportPlan: "导出拆柜单结果",
    exportPlanTooltip: "导出的表格在结构、格式和数据内容上，与导入的表格保持一致",
    outbound: "出库单",
    rules: "规则表",
    columnSettings: "列设置",
    manualUnload: "手动录入",
    queryContainerHistory: "查询历史柜号数据",

    // Rules Table
    colRange: "库位",
    colDest: "目的地标签",
    colType: "类别",
    colMax: "最大托盘",
    colCur: "当前托盘",
    colCartons: "箱数",
    colUtil: "利用率",
    colAllow: "允许数",
    colCurDest: "当前数",
    colStatus: "状态",
    colNote: "备注",
    colActions: "操作",
    statusOk: "正常",
    statusOverflow: "超标",
    
    // Pagination
    prevPage: "上一页",
    nextPage: "下一页",
    pageInfo: "第 {current} / {total} 页 (共 {items} 条)",

    // Location Types (V14)
    'amz-main-A': "亚马逊主区 (A)",
    'amz-main-BC': "亚马逊主区 (B/C)",
    'amz-buffer': "亚马逊偏仓 (D/E/G)",
    sehin: "希音专区 (A)",
    private: "私人地址 (V/G)",
    platform: "平台 (F/H)",
    express: "快递区 (A)",
    suspense: "暂存/中转区",
    highvalue: "贵品区 (R)",
    
    // WMS
    tabInventory: "库存看板",
    tabInbound: "入库/拆柜",
    tabOutbound: "出库/发货",
    tabMaster: "主数据",
    wmsModule: "模块",
    wmsIntegration: "WMS 集成",
    loadWms: "加载 WMS",
    noWmsUrl: "未配置 WMS 地址",
    enterWmsUrl: "在下方输入 WMS 系统地址以嵌入显示。",

    // WMS Descriptions
    descInventory: "查询 A/B/C/V/R 各区库存水平。导出库存快照。",
    descInbound: "处理到柜拆柜。根据库位规则生成上架任务。",
    descOutbound: "管理拣货单，核对发货，生成 BOL。",
    descMaster: "配置客户、目的地映射及用户权限。",

    // Cloud Sync
    cloudSync: "后端云存储",
    cloudDesc: "与远程服务器同步数据。",
    cloudSettings: "连接设置",
    serverUrl: "服务器接口地址",
    urlRequired: "请输入服务器地址",
    settingsSaved: "设置已保存",
    apiKey: "API 密钥 (可选)",
    pushToCloud: "上传更新数据",
    pullFromCloud: "下载同步数据",
    syncSuccess: "数据同步成功！",
    syncError: "同步失败，请检查网络或设置。",
    lastSync: "上次同步:",

    // Modals & Alerts
    cancel: "取消",
    selectDestinations: "选择目的地",
    maxAllowed: "最大允许",
    current: "当前",
    done: "完成",
    confirmDelete: "确定删除此规则？",
    confirmReset: "确定恢复默认？所有更改将丢失。",
    removeTag: "移除标签",
    importSuccess: "导入成功！",
    unloadSuccess: "拆柜单已成功处理。",
    containerMapImportSuccess: "柜号映射已更新",
    duplicateContainerError: "柜号 {container} 已导入，不能重复导入。",
    deductedPallets: "根据出库单已扣减托盘。",
    suggestedLocation: "库位安排",
    locationArrangementColumnNotFound: "已分配库位，但在您的Excel文件中未找到“库位安排”列。请添加此列以便在导出时查看库位安排。",
    history: "历史记录",
    noHistory: "该库位无操作记录。",
    updateFromOtherTab: "数据已在其他标签页中更新。",
    exceptionAdded: "已记录新的异常。",
    uiRefreshed: "界面已刷新，显示最新数据。",
    locationArrangement: "库位安排",

    // Add Rule
    range: "库位",
    maxPal: "最大",
    allowDest: "允许",
    note: "备注",
    
    // Manual Unload
    manualUnloadTitle: "手动录入拆柜单",
    addDestRow: "增加一行",
    processUnload: "开始排位",
    
    // Container History Modal
    containerHistoryTitle: "历史柜号查询",
    searchContainer: "搜索柜号...",
    containerDetails: "柜号详情",
    noContainerFound: "未找到相关柜号。",
    noContainerSelected: "请选择一个柜号查看详情。",
    
    // Exceptions
    containerNo: "柜号",
    pcNo: "派车单号",
    description: "异常描述",
    exceptionsTitle: "异常管理",
    exceptionsDesc: "追踪和管理操作中的异常情况。",
    addException: "新增异常",
    record: "记录异常",
    time: "时间",

    // AI Assistant
    assistantTitle: "AI 助手",
    assistantPlaceholder: "询问仓库状态...",

    // Dashboard Customization
    editLayout: "编辑布局",
    moveUp: "上移",
    moveDown: "下移",
    
    // User Management
    userManagement: "用户管理",
    manageUsersDesc: "添加、删除和管理用户账户。",
    addUser: "添加用户",
    role: "角色",
    deleteUser: "删除用户",
    confirmDeleteUser: "您确定要删除此用户吗？此操作无法撤销。",
    userAdded: "用户添加成功。",
    userDeleted: "用户删除成功。",
    userExists: "该用户名的用户已存在。",
    cannotDeleteSelf: "您不能删除自己的账户。",

    // Location Management
    locationManagement: "库位管理",
    locationManagementDesc: "添加或删除仓库中的库位代码。",
    addLocation: "添加库位",
    deleteLocation: "删除库位",
    confirmDeleteLocation: "确定删除库位 {locationCode} 吗？此操作无法撤销。",
    locationExistsError: "库位 {locationCode} 已存在。",
    locationNotEmptyError: "无法删除 {locationCode}，因为它包含托盘。",
    locationAdded: "库位 {locationCode} 添加成功。",
    locationDeleted: "库位 {locationCode} 删除成功。",
    addNewLocation: "添加新库位",
    locationCodePlaceholder: "输入新库位代码 (例如 A55)",
    existingLocations: "现有库位",
  }
};

type TranslationKeys = keyof typeof translations['en'];

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKeys, replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('zh');

  useEffect(() => {
    const savedLang = localStorage.getItem('app_language');
    if (savedLang === 'en' || savedLang === 'zh') {
      setLanguage(savedLang);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key: TranslationKeys, replacements?: Record<string, string | number>) => {
    let translation = translations[language][key] || key;
    if (replacements) {
        Object.keys(replacements).forEach(rKey => {
            translation = translation.replace(`{${rKey}}`, String(replacements[rKey]));
        });
    }
    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};