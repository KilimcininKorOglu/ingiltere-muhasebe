import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { vatService } from '../../services/api';
import { ArrowLeft, Calendar, Receipt, TrendingUp, TrendingDown, Scale, FileText, Download, Loader2, AlertCircle, CheckCircle, Clock } from 'lucide-react';

const VatReturnDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vatReturn, setVatReturn] = useState(null);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  useEffect(() => {
    fetchVatReturn();
  }, [id]);

  const fetchVatReturn = async () => {
    try {
      setLoading(true);
      const response = await vatService.getReturns();
      const vatReturns = response.data?.data?.vatReturns || response.data?.vatReturns || [];
      const found = vatReturns.find((r) => r.id.toString() === id);
      if (found) {
        setVatReturn(found);
      } else {
        setError(t('vat.returnNotFound'));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setExporting(true);
      setPdfError(null);
      const response = await vatService.exportReturnPdf(id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `vat-return-${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export PDF:', err);
      const errorMessage = err.response?.data?.error?.message;
      setPdfError(
        typeof errorMessage === 'object' 
          ? (errorMessage.tr || errorMessage.en || t('vat.pdfExportError'))
          : (errorMessage || t('vat.pdfExportError'))
      );
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format((amount || 0) / 100);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'submitted':
        return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: CheckCircle };
      case 'draft':
        return { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: Clock };
      case 'overdue':
        return { bg: 'bg-red-500/20', text: 'text-red-400', icon: AlertCircle };
      default:
        return { bg: 'bg-zinc-500/20', text: 'text-zinc-400', icon: FileText };
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'submitted': return t('vat.statusSubmitted');
      case 'draft': return t('vat.statusDraft');
      case 'overdue': return t('vat.statusOverdue');
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (error || !vatReturn) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/vat/returns" className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </Link>
          <h1 className="text-2xl font-bold text-white">{t('vat.vatReturn')}</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-16 bg-zinc-800/50 rounded-xl border border-zinc-700">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <p className="text-zinc-400">{error || t('vat.returnNotFound')}</p>
          <button
            onClick={() => navigate('/vat/returns')}
            className="mt-4 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  const statusStyle = getStatusBadge(vatReturn.status);
  const StatusIcon = statusStyle.icon;
  const netVat = vatReturn.box5 || 0;
  const isRefund = netVat < 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/vat/returns" className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{t('vat.vatReturn')}</h1>
            <p className="text-zinc-400 text-sm mt-1">
              {formatDate(vatReturn.periodStart)} - {formatDate(vatReturn.periodEnd)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${statusStyle.bg} ${statusStyle.text}`}>
            <StatusIcon className="w-4 h-4" />
            {getStatusLabel(vatReturn.status)}
          </span>
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-700/50 text-white rounded-lg font-medium transition-colors"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            PDF
          </button>
        </div>
      </div>

      {/* PDF Error */}
      {pdfError && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-400">{pdfError}</span>
          <button
            onClick={() => setPdfError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            &times;
          </button>
        </div>
      )}

      {/* Period Info */}
      <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">{t('vat.period')}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-sm text-zinc-500">{t('vat.periodStart')}</span>
            <p className="text-white font-medium">{formatDate(vatReturn.periodStart)}</p>
          </div>
          <div>
            <span className="text-sm text-zinc-500">{t('vat.periodEnd')}</span>
            <p className="text-white font-medium">{formatDate(vatReturn.periodEnd)}</p>
          </div>
          <div>
            <span className="text-sm text-zinc-500">{t('vat.dueDate')}</span>
            <p className="text-white font-medium">{formatDate(vatReturn.dueDate) || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-zinc-500">{t('common.status')}</span>
            <p className={`font-medium ${statusStyle.text}`}>{getStatusLabel(vatReturn.status)}</p>
          </div>
        </div>
      </div>

      {/* VAT Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Output VAT (Box 1) */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-400">{t('vat.outputVat')}</h3>
              <p className="text-xs text-zinc-500">Box 1</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(vatReturn.box1)}</p>
        </div>

        {/* Input VAT (Box 4) */}
        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-400">{t('vat.inputVat')}</h3>
              <p className="text-xs text-zinc-500">Box 4</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{formatCurrency(vatReturn.box4)}</p>
        </div>

        {/* Net VAT (Box 5) */}
        <div className={`bg-zinc-800/50 rounded-xl border p-6 ${isRefund ? 'border-emerald-500/30' : 'border-amber-500/30'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isRefund ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
              <Scale className={`w-5 h-5 ${isRefund ? 'text-emerald-400' : 'text-amber-400'}`} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-400">{t('vat.netVat')}</h3>
              <p className="text-xs text-zinc-500">Box 5</p>
            </div>
          </div>
          <p className={`text-2xl font-bold ${isRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
            {formatCurrency(Math.abs(netVat))}
          </p>
          <span className="text-xs text-zinc-500">
            {isRefund ? t('vat.refundDue') : t('vat.owedToHmrc')}
          </span>
        </div>
      </div>

      {/* Box Details */}
      <div className="bg-zinc-800/50 rounded-xl border border-zinc-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-zinc-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">{t('vat.boxDetails')}</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-zinc-700">
            <div>
              <span className="text-white font-medium">Box 1</span>
              <p className="text-xs text-zinc-500">{t('vat.box1Desc')}</p>
            </div>
            <span className="text-white font-medium">{formatCurrency(vatReturn.box1)}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-zinc-700">
            <div>
              <span className="text-white font-medium">Box 2</span>
              <p className="text-xs text-zinc-500">{t('vat.box2Desc')}</p>
            </div>
            <span className="text-white font-medium">{formatCurrency(vatReturn.box2)}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-zinc-700">
            <div>
              <span className="text-white font-medium">Box 3</span>
              <p className="text-xs text-zinc-500">{t('vat.box3Desc')}</p>
            </div>
            <span className="text-white font-medium">{formatCurrency(vatReturn.box3)}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-zinc-700">
            <div>
              <span className="text-white font-medium">Box 4</span>
              <p className="text-xs text-zinc-500">{t('vat.box4Desc')}</p>
            </div>
            <span className="text-white font-medium">{formatCurrency(vatReturn.box4)}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-zinc-700">
            <div>
              <span className="text-white font-medium">Box 5</span>
              <p className="text-xs text-zinc-500">{t('vat.box5Desc')}</p>
            </div>
            <span className={`font-medium ${isRefund ? 'text-emerald-400' : 'text-amber-400'}`}>
              {formatCurrency(Math.abs(netVat))}
            </span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-zinc-700">
            <div>
              <span className="text-white font-medium">Box 6</span>
              <p className="text-xs text-zinc-500">{t('vat.box6Desc')}</p>
            </div>
            <span className="text-white font-medium">{formatCurrency(vatReturn.box6)}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-zinc-700">
            <div>
              <span className="text-white font-medium">Box 7</span>
              <p className="text-xs text-zinc-500">{t('vat.box7Desc')}</p>
            </div>
            <span className="text-white font-medium">{formatCurrency(vatReturn.box7)}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-zinc-700">
            <div>
              <span className="text-white font-medium">Box 8</span>
              <p className="text-xs text-zinc-500">{t('vat.box8Desc')}</p>
            </div>
            <span className="text-white font-medium">{formatCurrency(vatReturn.box8)}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <span className="text-white font-medium">Box 9</span>
              <p className="text-xs text-zinc-500">{t('vat.box9Desc')}</p>
            </div>
            <span className="text-white font-medium">{formatCurrency(vatReturn.box9)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Link
          to="/vat/returns"
          className="px-6 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors"
        >
          {t('common.back')}
        </Link>
      </div>
    </div>
  );
};

export default VatReturnDetail;
