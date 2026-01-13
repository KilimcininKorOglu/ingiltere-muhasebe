import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { vatService, transactionService } from '../../services/api';
import VatReturnWizard from '../../components/vat/VatReturnWizard';
import { ArrowLeft } from 'lucide-react';

const VatReturnNew = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleComplete = (data) => {
    navigate('/vat/returns');
  };

  const handleCancel = () => {
    navigate('/vat');
  };

  const vatReturnsApi = {
    getVatReturns: async (params) => {
      const response = await vatService.getReturns(params);
      return response.data;
    },
    createVatReturn: async (data) => {
      const response = await vatService.createReturn(data);
      return response.data;
    },
  };

  const transactionsApi = {
    getTransactions: async (params) => {
      const response = await transactionService.getAll(params);
      return { data: response.data?.data?.transactions || response.data?.transactions || [] };
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/vat"
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{t('vat.newReturn')}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t('vat.newReturnSubtitle')}</p>
        </div>
      </div>

      <VatReturnWizard
        onComplete={handleComplete}
        onCancel={handleCancel}
        vatReturnsApi={vatReturnsApi}
        transactionsApi={transactionsApi}
        isOpen={true}
      />
    </div>
  );
};

export default VatReturnNew;
