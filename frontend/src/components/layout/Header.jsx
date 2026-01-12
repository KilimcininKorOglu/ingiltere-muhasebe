import './Header.css';

const Header = ({ title, children }) => {
  return (
    <header className="page-header">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
      </div>
      {children && (
        <div className="header-right">
          {children}
        </div>
      )}
    </header>
  );
};

export default Header;
