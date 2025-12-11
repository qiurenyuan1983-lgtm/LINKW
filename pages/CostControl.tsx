
import React, { useState, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { 
    DollarSign, Wrench, Package, Truck, Wallet, FileText, 
    Plus, Search, AlertTriangle, CheckCircle, XCircle, BarChart3, X, Filter 
} from 'lucide-react';
import { 
    Vendor, Asset, MaintenanceRecord, ProcurementRequest, VendorRating 
} from '../types';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

// --- 中文演示数据生成器 ---
const generateVendors = (): Vendor[] => [
    { id: 'v1', name: '环球包装耗材有限公司', type: 'supplies', contactName: '张伟', contactPhone: '138-0011-2233', rating: 'A', status: 'active' },
    { id: 'v2', name: '极速维修服务部', type: 'maintenance', contactName: '李强', contactPhone: '139-2233-4455', rating: 'B', status: 'active' },
    { id: 'v3', name: '科技装备解决方案', type: 'equipment', contactName: '王芳', contactPhone: '137-6677-8899', rating: 'A', status: 'active' },
    { id: 'v4', name: '廉价供应站', type: 'supplies', contactName: '赵敏', contactPhone: '136-9988-7766', rating: 'C', ratingReason: '交货经常延迟', status: 'active' },
    { id: 'v5', name: '诚信缺失服务商', type: 'service', contactName: '钱多', contactPhone: '135-5544-3322', rating: 'D', ratingReason: '存在欺诈行为', status: 'blacklisted' },
];

const generateAssets = (): Asset[] => [
    { id: 'a1', name: '丰田叉车 8F #1', model: '8FGCU25', category: 'forklift', location: 'A区', owner: '汤姆', purchaseDate: '2023-01-15', value: 25000, status: 'active', maintenanceCount: 0 },
    { id: 'a2', name: '丰田叉车 8F #2', model: '8FGCU25', category: 'forklift', location: 'B区', owner: '杰瑞', purchaseDate: '2023-02-20', value: 25000, status: 'maintenance', maintenanceCount: 3 },
    { id: 'a3', name: '自动缠膜机 X1', model: 'W-2000', category: 'packaging', location: '打包区', owner: '爱丽丝', purchaseDate: '2022-11-05', value: 5000, status: 'active', maintenanceCount: 1 },
    { id: 'a4', name: '戴尔服务器 R740', model: 'PowerEdge', category: 'it', location: '机房', owner: '迈克', purchaseDate: '2024-01-10', value: 8000, status: 'active', maintenanceCount: 0 },
];

const generateMaintenance = (): MaintenanceRecord[] => [
    { id: 'm1', assetId: 'a2', assetName: '丰田叉车 8F #2', type: 'repair', description: '液压管路修复', cost: 450, date: '2024-03-10', vendorId: 'v2', isResolved: true },
    { id: 'm2', assetId: 'a2', assetName: '丰田叉车 8F #2', type: 'repair', description: '更换后轮胎', cost: 200, date: '2024-04-05', vendorId: 'v2', isResolved: true },
    { id: 'm3', assetId: 'a3', assetName: '自动缠膜机 X1', type: 'maintenance', description: '年度保养', cost: 150, date: '2024-02-15', vendorId: 'v3', isResolved: true },
    { id: 'm4', assetId: 'a2', assetName: '丰田叉车 8F #2', type: 'repair', description: '发动机故障检查', cost: 600, date: '2024-05-20', vendorId: 'v2', isResolved: false }, 
];

const generateProcurement = (): ProcurementRequest[] => [
    { id: 'p1', itemName: '拉伸膜 (每卷)', category: 'consumable', quantity: 50, estimatedCost: 1200, reason: '库存不足', requester: '仓库主管', status: 'ordered', date: '2024-05-25' },
    { id: 'p2', itemName: '无线扫码枪', category: 'device', quantity: 5, estimatedCost: 2500, reason: '新员工入职', requester: 'IT部门', status: 'pending', date: '2024-06-01' },
];

const CostControl: React.FC = () => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'procurement' | 'maintenance' | 'assets' | 'reimburse' | 'ledger' | 'vendors'>('ledger');
    
    // Data State
    const [vendors, setVendors] = useState<Vendor[]>(generateVendors());
    const [assets, setAssets] = useState<Asset[]>(generateAssets());
    const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>(generateMaintenance());
    const [procurement, setProcurement] = useState<ProcurementRequest[]>(generateProcurement());

    // Modal State
    const [modalType, setModalType] = useState<'vendor' | 'asset' | 'maintenance' | 'procurement' | null>(null);
    
    // Form State (Generic container for new entries)
    const [formData, setFormData] = useState<any>({});

    // Analytics Data
    const totalExpenses = maintenance.reduce((sum, m) => sum + m.cost, 0);
    const expensesByType = maintenance.reduce((acc, m) => {
        const typeName = m.type === 'repair' ? '故障维修' : '定期保养';
        acc[typeName] = (acc[typeName] || 0) + m.cost;
        return acc;
    }, {} as Record<string, number>);
    const expenseChartData = Object.entries(expensesByType).map(([name, value]) => ({ name, value }));
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    // --- Helpers ---
    const getRatingColor = (r: VendorRating) => {
        switch(r) {
            case 'A': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'B': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'C': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'D': return 'bg-red-100 text-red-800 border-red-200';
        }
    };

    const getStatusText = (status: string) => {
        const map: Record<string, string> = {
            'active': '正常',
            'maintenance': '维修中',
            'retired': '已报废',
            'blacklisted': '已拉黑',
            'pending': '待审批',
            'approved': '已批准',
            'rejected': '已驳回',
            'ordered': '已采购',
            'supplies': '耗材',
            'equipment': '设备',
            'service': '服务',
            'repair': '维修',
            'forklift': '叉车',
            'packaging': '包装',
            'it': 'IT设备',
            'automation': '自动化',
            'furniture': '家具',
            'consumable': '耗材',
            'device': '设备',
            'part': '配件'
        };
        return map[status] || status;
    };

    const handleOpenModal = (type: 'vendor' | 'asset' | 'maintenance' | 'procurement') => {
        setModalType(type);
        // Reset form data based on type
        if (type === 'vendor') setFormData({ type: 'supplies', rating: 'B', status: 'active' });
        if (type === 'asset') setFormData({ category: 'forklift', status: 'active', value: 0 });
        if (type === 'maintenance') setFormData({ type: 'repair', isResolved: true, cost: 0 });
        if (type === 'procurement') setFormData({ category: 'consumable', status: 'pending', estimatedCost: 0, quantity: 1 });
    };

    const handleSave = () => {
        if (modalType === 'vendor') {
            setVendors([...vendors, { ...formData, id: `v${Date.now()}` }]);
        } else if (modalType === 'asset') {
            setAssets([...assets, { ...formData, id: `a${Date.now()}`, maintenanceCount: 0 }]);
        } else if (modalType === 'maintenance') {
            // Enrich with asset name
            const assetName = assets.find(a => a.id === formData.assetId)?.name || '未知资产';
            setMaintenance([...maintenance, { 
                ...formData, 
                id: `m${Date.now()}`,
                assetName,
                date: new Date().toISOString().split('T')[0]
            }]);
        } else if (modalType === 'procurement') {
            setProcurement([...procurement, {
                ...formData,
                id: `p${Date.now()}`,
                date: new Date().toISOString().split('T')[0],
                requester: '当前用户'
            }]);
        }
        setModalType(null);
        setFormData({});
    };

    // --- Tab Components ---
    
    const VendorsTab = () => (
        <div className="space-y-4 animate-fade-in-up">
            <div className="flex justify-between items-center mb-4">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" placeholder="搜索供应商..." />
                </div>
                <button 
                    onClick={() => handleOpenModal('vendor')}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                    <Plus size={16} /> 新增供应商
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vendors.map(v => (
                    <div key={v.id} className={`p-4 bg-white rounded-xl border shadow-sm relative group hover:shadow-md transition-all ${v.status === 'blacklisted' ? 'opacity-75 bg-slate-50' : ''}`}>
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-slate-800">{v.name}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-bold border ${getRatingColor(v.rating)}`}>
                                {v.rating}级
                            </span>
                        </div>
                        <div className="text-xs text-slate-500 space-y-1">
                            <p className="flex justify-between"><span>类型:</span> <span className="font-medium capitalize px-1.5 py-0.5 bg-slate-100 rounded">{getStatusText(v.type)}</span></p>
                            <p className="flex justify-between"><span>联系人:</span> <span>{v.contactName}</span></p>
                            <p className="flex justify-between"><span>电话:</span> <span>{v.contactPhone}</span></p>
                        </div>
                        {v.ratingReason && (
                            <div className="mt-3 p-2 bg-slate-50 text-xs text-slate-600 rounded italic border border-slate-100">
                                "{v.ratingReason}"
                            </div>
                        )}
                        {v.status === 'blacklisted' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px] rounded-xl">
                                <span className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full transform -rotate-12 shadow-lg">已拉黑</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );

    const AssetsTab = () => (
        <div className="space-y-4 animate-fade-in-up">
            <div className="flex justify-end mb-4">
                <button 
                    onClick={() => handleOpenModal('asset')}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                    <Plus size={16} /> 新增资产
                </button>
            </div>
            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                        <tr>
                            <th className="px-4 py-3">资产名称</th>
                            <th className="px-4 py-3">型号</th>
                            <th className="px-4 py-3">分类</th>
                            <th className="px-4 py-3">位置</th>
                            <th className="px-4 py-3">责任人</th>
                            <th className="px-4 py-3 text-right">价值</th>
                            <th className="px-4 py-3 text-center">状态</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {assets.map(a => (
                            <tr key={a.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-medium text-slate-700">{a.name}</td>
                                <td className="px-4 py-3 text-slate-500">{a.model}</td>
                                <td className="px-4 py-3 text-slate-500 capitalize"><span className="bg-slate-100 px-2 py-0.5 rounded text-xs">{getStatusText(a.category)}</span></td>
                                <td className="px-4 py-3 text-slate-500">{a.location}</td>
                                <td className="px-4 py-3 text-slate-500 flex items-center gap-2">
                                    <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                                        {a.owner.charAt(0)}
                                    </div>
                                    {a.owner}
                                </td>
                                <td className="px-4 py-3 text-right font-mono">${a.value.toLocaleString()}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        a.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                        a.status === 'maintenance' ? 'bg-orange-100 text-orange-700' :
                                        'bg-slate-200 text-slate-600'
                                    }`}>
                                        {getStatusText(a.status)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const MaintenanceTab = () => (
        <div className="space-y-4 animate-fade-in-up">
            {/* Logic Alert for Frequent Repairs */}
            {maintenance.filter(m => m.assetId === 'a2').length >= 3 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="text-red-500 mt-0.5" />
                    <div>
                        <h4 className="font-bold text-red-800">频繁维修提醒</h4>
                        <p className="text-sm text-red-600">资产 "丰田叉车 8F #2" 近期已维修 3 次，建议评估更换。</p>
                    </div>
                </div>
            )}

            <div className="flex justify-end mb-4">
                <button 
                    onClick={() => handleOpenModal('maintenance')}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                    <Plus size={16} /> 新增记录
                </button>
            </div>

            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                        <tr>
                            <th className="px-4 py-3">日期</th>
                            <th className="px-4 py-3">资产</th>
                            <th className="px-4 py-3">类型</th>
                            <th className="px-4 py-3">问题描述</th>
                            <th className="px-4 py-3">服务商</th>
                            <th className="px-4 py-3 text-right">费用</th>
                            <th className="px-4 py-3 text-center">状态</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {maintenance.map(m => (
                            <tr key={m.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 text-slate-500">{m.date}</td>
                                <td className="px-4 py-3 font-medium text-slate-700">{m.assetName}</td>
                                <td className="px-4 py-3 text-slate-500 capitalize">{getStatusText(m.type)}</td>
                                <td className="px-4 py-3 text-slate-500">{m.description}</td>
                                <td className="px-4 py-3 text-slate-500">{vendors.find(v => v.id === m.vendorId)?.name || '未知'}</td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">${m.cost}</td>
                                <td className="px-4 py-3 text-center">
                                    {m.isResolved ? (
                                        <span className="text-emerald-600 flex justify-center" title="已解决"><CheckCircle size={16} /></span>
                                    ) : (
                                        <span className="text-orange-500 flex justify-center" title="处理中"><Wrench size={16} /></span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const ProcurementTab = () => (
        <div className="space-y-4 animate-fade-in-up">
            <div className="flex justify-end mb-4">
                <button 
                    onClick={() => handleOpenModal('procurement')}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                    <Plus size={16} /> 新建申请
                </button>
            </div>
            <div className="grid gap-4">
                {procurement.map(item => (
                    <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-slate-800">{item.itemName}</h4>
                                <span className="text-xs bg-slate-100 px-2 py-0.5 rounded capitalize text-slate-600">{getStatusText(item.category)}</span>
                            </div>
                            <p className="text-sm text-slate-500">数量: {item.quantity} | 预估: ${item.estimatedCost}</p>
                            <p className="text-xs text-slate-400 mt-1">原因: {item.reason}</p>
                        </div>
                        <div className="text-right">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                item.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                item.status === 'ordered' ? 'bg-blue-100 text-blue-700' :
                                item.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                'bg-orange-100 text-orange-700'
                            }`}>
                                {getStatusText(item.status)}
                            </span>
                            <div className="text-xs text-slate-400 mt-2">{item.date}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const LedgerTab = () => (
        <div className="space-y-6 animate-fade-in-up">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-slate-500 text-sm font-medium mb-2">总支出 (Total)</h3>
                    <p className="text-3xl font-bold text-slate-800">${totalExpenses.toLocaleString()}</p>
                    <div className="mt-4 text-xs text-emerald-600 flex items-center gap-1">
                        <BarChart3 size={12} /> 环比下降 5%
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm col-span-2">
                    <h3 className="text-slate-500 text-sm font-medium mb-4">费用构成 (Breakdown)</h3>
                    <div className="h-40 flex">
                        <ResponsiveContainer width="50%" height="100%">
                            <PieChart>
                                <Pie data={expenseChartData} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                                    {expenseChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => `$${value}`} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="w-1/2 flex flex-col justify-center gap-2 text-xs">
                            {expenseChartData.map((d, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                                    <span className="capitalize text-slate-600">{d.name}</span>
                                    <span className="font-bold ml-auto">${d.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const tabs = [
        { id: 'ledger', label: '费用台账', icon: BarChart3 },
        { id: 'procurement', label: '采购申请', icon: Package },
        { id: 'maintenance', label: '维修记录', icon: Wrench },
        { id: 'assets', label: '固定资产', icon: Truck },
        { id: 'reimburse', label: '报销管理', icon: Wallet },
        { id: 'vendors', label: '供应商', icon: FileText },
    ];
    
    // Calculate the icon for the active tab to use in placeholder view
    const activeTabInfo = tabs.find(t => t.id === activeTab);
    const ActiveTabIcon = activeTabInfo ? activeTabInfo.icon : FileText;

    const getModalTitle = (type: string) => {
        switch(type) {
            case 'vendor': return '添加供应商';
            case 'asset': return '添加固定资产';
            case 'maintenance': return '添加维修记录';
            case 'procurement': return '新建采购申请';
            default: return '添加';
        }
    }

    return (
        <div className="h-full flex flex-col space-y-6 relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <DollarSign className="text-blue-600" /> 内部管理
                    </h1>
                    <p className="text-slate-500">管理费用、资产设备、采购及供应商信息。</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                            activeTab === tab.id 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200'
                        }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1">
                {activeTab === 'vendors' && <VendorsTab />}
                {activeTab === 'assets' && <AssetsTab />}
                {activeTab === 'maintenance' && <MaintenanceTab />}
                {activeTab === 'ledger' && <LedgerTab />}
                {activeTab === 'procurement' && <ProcurementTab />}
                {/* Placeholders for simple tabs */}
                {activeTab === 'reimburse' && (
                    <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                        <ActiveTabIcon size={48} className="mb-2 opacity-20" />
                        <p>该模块正在建设中 (Under Construction)。</p>
                    </div>
                )}
            </div>

            {/* General Modal for Adding Items */}
            {modalType && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={() => setModalType(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-[500px] max-w-[95%] flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                            <h3 className="text-lg font-bold text-slate-800">{getModalTitle(modalType)}</h3>
                            <button onClick={() => setModalType(null)} className="p-1 rounded hover:bg-slate-200"><X size={20} /></button>
                        </div>
                        
                        <div className="p-6 space-y-4 overflow-y-auto">
                            {/* Vendor Form */}
                            {modalType === 'vendor' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">供应商名称</label>
                                        <input className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="例如：某某包装材料公司" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">类型</label>
                                            <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                                                <option value="supplies">耗材 (Supplies)</option>
                                                <option value="equipment">设备 (Equipment)</option>
                                                <option value="maintenance">维修 (Maintenance)</option>
                                                <option value="service">服务 (Service)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">评级</label>
                                            <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white" value={formData.rating} onChange={e => setFormData({...formData, rating: e.target.value})}>
                                                <option value="A">A级</option>
                                                <option value="B">B级</option>
                                                <option value="C">C级</option>
                                                <option value="D">D级</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">联系人</label>
                                            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.contactName || ''} onChange={e => setFormData({...formData, contactName: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">电话</label>
                                            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.contactPhone || ''} onChange={e => setFormData({...formData, contactPhone: e.target.value})} />
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Asset Form */}
                            {modalType === 'asset' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">资产名称</label>
                                        <input className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="例如：叉车 #5" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">分类</label>
                                            <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                                                <option value="forklift">叉车</option>
                                                <option value="packaging">包装设备</option>
                                                <option value="it">IT/办公设备</option>
                                                <option value="automation">自动化设备</option>
                                                <option value="furniture">家具</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">型号</label>
                                            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.model || ''} onChange={e => setFormData({...formData, model: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">位置</label>
                                            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.location || ''} onChange={e => setFormData({...formData, location: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">责任人</label>
                                            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.owner || ''} onChange={e => setFormData({...formData, owner: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">价值 ($)</label>
                                            <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.value} onChange={e => setFormData({...formData, value: Number(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">状态</label>
                                            <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                                                <option value="active">正常</option>
                                                <option value="maintenance">维修中</option>
                                                <option value="retired">已报废</option>
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Maintenance Form */}
                            {modalType === 'maintenance' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">关联资产</label>
                                        <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white" value={formData.assetId || ''} onChange={e => setFormData({...formData, assetId: e.target.value})}>
                                            <option value="">选择资产...</option>
                                            {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">类型</label>
                                            <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                                                <option value="repair">故障维修</option>
                                                <option value="maintenance">定期保养</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">服务商</label>
                                            <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white" value={formData.vendorId || ''} onChange={e => setFormData({...formData, vendorId: e.target.value})}>
                                                <option value="">选择服务商...</option>
                                                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">内容描述</label>
                                        <input className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="例如：更换电池" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 items-center">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">费用 ($)</label>
                                            <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.cost} onChange={e => setFormData({...formData, cost: Number(e.target.value)})} />
                                        </div>
                                        <div className="flex items-center gap-2 mt-4">
                                            <input type="checkbox" id="resolved" className="rounded text-blue-600" checked={formData.isResolved} onChange={e => setFormData({...formData, isResolved: e.target.checked})} />
                                            <label htmlFor="resolved" className="text-sm text-slate-700">问题已解决</label>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Procurement Form */}
                            {modalType === 'procurement' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">物品名称</label>
                                        <input className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.itemName || ''} onChange={e => setFormData({...formData, itemName: e.target.value})} placeholder="例如：封箱胶带" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">分类</label>
                                            <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                                                <option value="consumable">耗材</option>
                                                <option value="device">设备仪器</option>
                                                <option value="part">备件</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">数量</label>
                                            <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.quantity} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">预估费用 ($)</label>
                                        <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={formData.estimatedCost} onChange={e => setFormData({...formData, estimatedCost: Number(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">申请原因</label>
                                        <textarea className="w-full border rounded-lg px-3 py-2 text-sm h-20" value={formData.reason || ''} onChange={e => setFormData({...formData, reason: e.target.value})} placeholder="为什么需要采购此物品？" />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="p-4 border-t bg-slate-50 rounded-b-xl flex justify-end gap-2">
                            <button onClick={() => setModalType(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm">取消</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium">保存</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CostControl;
