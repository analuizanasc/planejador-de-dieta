import { Outlet } from 'react-router-dom';
import { Nav } from '../components/Nav';
import styles from './AppLayout.module.css';

export function AppLayout() {
  return (
    <div className={styles.pagina}>
      <Nav />
      <main className={styles.conteudo}>
        <Outlet />
      </main>
    </div>
  );
}
