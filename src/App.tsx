import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { READER_ONLY } from './lib/features';
import { Library } from './pages/Library';
import { BookDetail } from './pages/BookDetail';
import { Reader } from './pages/Reader';
import { MyShelf } from './pages/MyShelf';
import { Safeguarding } from './pages/Safeguarding';

// Staff pages load on demand, so readers never download them. The reader-only build
// (READER_ONLY) drops them from the bundle altogether.
// (The check is spelled out here, not via READER_ONLY, so the bundler can drop the imports.)
const studio = () => (import.meta.env.VITE_READER_ONLY === '1' ? Promise.reject(new Error('Reader-only build')) : import('./pages/studio'));
const StudioDashboard = lazy(() => studio().then((m) => ({ default: m.StudioDashboard })));
const StudioEditor = lazy(() => studio().then((m) => ({ default: m.StudioEditor })));
const ReviewQueue = lazy(() => studio().then((m) => ({ default: m.ReviewQueue })));
const ReviewBook = lazy(() => studio().then((m) => ({ default: m.ReviewBook })));
const StaffAdmin = lazy(() => studio().then((m) => ({ default: m.StaffAdmin })));
const SignIn = lazy(() => (import.meta.env.VITE_READER_ONLY === '1' ? Promise.reject(new Error('Reader-only build')) : import('./pages/SignIn'))
  .then((m) => ({ default: m.SignIn })));

export default function App() {
  return (
    <ErrorBoundary>
      <div className="app">
        <Suspense fallback={<div className="loading">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Library />} />
            <Route path="/book/:id" element={<BookDetail />} />
            <Route path="/read/:id" element={<Reader />} />
            <Route path="/my-shelf" element={<MyShelf />} />
            <Route path="/my-library" element={<Navigate to="/my-shelf" replace />} />
            <Route path="/about/safeguarding" element={<Safeguarding />} />
            {!READER_ONLY && (
              <>
                <Route path="/sign-in" element={<SignIn />} />
                <Route path="/studio" element={<StudioDashboard />} />
                <Route path="/studio/review" element={<ReviewQueue />} />
                <Route path="/studio/review/:id" element={<ReviewBook />} />
                <Route path="/studio/staff" element={<StaffAdmin />} />
                <Route path="/studio/:type/:id" element={<StudioEditor />} />
              </>
            )}
          </Routes>
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
