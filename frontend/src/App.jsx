import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth } from './routes/RequireAuth';
import { AppLayout } from './routes/AppLayout';
import { Login } from './pages/Login';
import { Registro } from './pages/Registro';
import { Receitas } from './pages/Receitas';
import { ImportarReceita } from './pages/ImportarReceita';
import { Preferencias } from './pages/Preferencias';
import { CardapioSemana } from './pages/CardapioSemana';
import { CardapioMes } from './pages/CardapioMes';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/entrar" element={<Login />} />
          <Route path="/registrar" element={<Registro />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/receitas" element={<Receitas />} />
              <Route path="/receitas/importar" element={<ImportarReceita />} />
              <Route path="/preferencias" element={<Preferencias />} />
              <Route path="/cardapio/semana" element={<CardapioSemana />} />
              <Route path="/cardapio/mes" element={<CardapioMes />} />
              <Route path="/" element={<Navigate to="/cardapio/semana" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
