import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/datamap': 'Data Map',
  '/audience': 'Audience',
  '/campaigns': 'Campaigns',
  '/automations': 'Automations',
  '/reports': 'Reports',
  '/import': 'Data Import',
};

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/audience/segments/new')) return 'Create Segment';
  if (pathname.startsWith('/audience/segments') && pathname.endsWith('/edit')) return 'Edit Segment';
  if (pathname.startsWith('/campaigns/new')) return 'Create Campaign';
  if (pathname.startsWith('/campaigns/') && pathname.endsWith('/edit')) return 'Edit Campaign';
  if (pathname.startsWith('/reports/campaigns/')) return 'Campaign Report';
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname.startsWith(path)) return title;
  }
  return 'MailerPlatform';
}

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const userEmail = localStorage.getItem('userEmail') || '';
  const title = getPageTitle(location.pathname);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{userEmail}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
