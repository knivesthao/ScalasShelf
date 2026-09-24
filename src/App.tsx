import { Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InstallPrompt } from './components/InstallPrompt';
import { Library } from './pages/Library';
import { BookDetail } from './pages/BookDetail';
import { Reader } from './pages/Reader';
import { MyLibrary } from './pages/MyLibrary';
import { StudioDashboard, StudioEditor } from './pages/studio';

export default function App() {
  return (
    <ErrorBoundary>
      <div className="app">
        <InstallPrompt />
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/book/:id" element={<BookDetail />} />
          <Route path="/read/:id" element={<Reader />} />
          <Route path="/my-library" element={<MyLibrary />} />
          <Route path="/studio" element={<StudioDashboard />} />
          <Route path="/studio/:type/:id" element={<StudioEditor />} />
        </Routes>
      </div>
    </ErrorBoundary>
  );
}
