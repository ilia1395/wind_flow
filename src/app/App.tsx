import { useEffect } from 'react';
import { VectorFieldPage } from '@pages/VectorFieldPage';
import { useWindStore } from '@entities/WindData';

function App() {
  useEffect(() => {
    // Kick off wind data loading once at app start
    useWindStore.getState().loadByUrl();
  }, []);

  return <VectorFieldPage />;
}

export default App;