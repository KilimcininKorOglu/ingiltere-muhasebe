import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { vatService, transactionService } from '../../services/api';
import VatReturnWizard from '../../components/vat/VatReturnWizard';
import Header from '../../components/layout/Header';
import './Vat.css';

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
      // API returns { data: { transactions: [] } }, extract the array
      return { data: response.data?.data?.transactions || response.data?.transactions || [] };
    },
  };

  return (
    <div className="page-container">
      <Header title={t('vat.newReturn')} />
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
