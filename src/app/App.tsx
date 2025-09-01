import { useEffect } from 'react';
import { DashboardPage } from '@/pages/Dashboard';
import { useWindStore } from '@/entities/WindData';

function App() {
  useEffect(() => {
    // Kick off wind data loading once at app start
    useWindStore.getState().loadByUrl();
  }, []);

  return < DashboardPage />
}

export default App;