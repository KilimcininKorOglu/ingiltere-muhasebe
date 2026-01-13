const Header = ({ title, children }) => {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pt-12 lg:pt-0">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {title}
        </h1>
      </div>
      {children && (
        <div className="flex items-center gap-3">
          {children}
        </div>
      )}
    </header>
  );
};

export default Header;
