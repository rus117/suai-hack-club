import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import '@fontsource-variable/manrope';
import '@fontsource-variable/jetbrains-mono';
import './styles.css';
import './learning.css';
import { Layout } from './components/Layout';
import { Home } from './Home';
import { EventPage } from './EventPage';
import { NotFound, Privacy } from './InfoPages';

const Register = lazy(() => import('./Register').then(module => ({ default: module.Register })));
const Prepare = lazy(() => import('./Prepare').then(module => ({ default: module.Prepare })));
const MaterialPage = lazy(() => import('./Prepare').then(module => ({ default: module.MaterialPage })));
const Challenge = lazy(() => import('./Challenge').then(module => ({ default: module.Challenge })));
const Leaderboard = lazy(() => import('./Leaderboard').then(module => ({ default: module.Leaderboard })));
const Restore = lazy(() => import('./Restore').then(module => ({ default: module.Restore })));
const Admin = lazy(() => import('./Admin').then(module => ({ default: module.Admin })));

createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><Suspense fallback={<div className="container page-section" role="status">Загружаем страницу…</div>}><Routes><Route element={<Layout />}><Route index element={<Home />} /><Route path="events/:id" element={<EventPage />} /><Route path="register" element={<Register />} /><Route path="prepare" element={<Prepare />} /><Route path="prepare/:slug" element={<MaterialPage />} /><Route path="challenge" element={<Challenge />} /><Route path="leaderboard" element={<Leaderboard />} /><Route path="privacy" element={<Privacy />} /><Route path="admin" element={<Admin />} /><Route path="restore" element={<Restore />} /><Route path="*" element={<NotFound />} /></Route></Routes></Suspense></BrowserRouter></StrictMode>);
