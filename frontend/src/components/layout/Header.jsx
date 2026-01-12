import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher';
import './Header.css';

const Header = ({ title, children }) => {
  const { t } = useTranslation();

  return (
    <header className="page-header">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
      </div>
      <div className="header-right">
        {children}
        <LanguageSwitcher variant="buttons" />
      </div>
    </header>
  );
};

export default Header;
