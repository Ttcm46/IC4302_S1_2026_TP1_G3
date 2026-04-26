import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated as hasSession } from './services/session';
import './styles/index.css';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import ChangePassword from './pages/auth/ChangePassword';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import CourseCatalog from './pages/CourseCatalog';
import CourseDetail from './pages/CourseDetail';
import CreateCourse from './pages/CreateCourse';
import CourseEditor from './pages/CourseEditor';
import SectionEditor from './pages/SectionEditor';
import AssessmentEditor from './pages/AssessmentEditor';
import AssessmentSubmissions from './pages/AssessmentSubmissions';
import CourseMembers from './pages/CourseMembers';
import CloneCourse from './pages/CloneCourse';
import StudentCourseView from './pages/StudentCourseView';
import StudentSectionView from './pages/StudentSectionView';
import AssessmentAttempt from './pages/AssessmentAttempt';
import AssessmentResult from './pages/AssessmentResult';
import Community from './pages/Community';
import Messaging from './pages/Messaging';

function isAuthenticated() {
  return hasSession();
}

function ProtectedRoute({ children }) {
  if (!isAuthenticated()) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={isAuthenticated() ? <Navigate to="/dashboard" replace /> : <Layout><Home /></Layout>} />
        <Route path="/login" element={isAuthenticated() ? <Navigate to="/dashboard" replace /> : <Layout><Login /></Layout>} />
        <Route path="/register" element={isAuthenticated() ? <Navigate to="/dashboard" replace /> : <Layout><Register /></Layout>} />
        <Route path="/forgot-password" element={<Layout><ForgotPassword /></Layout>} />
        <Route path="/reset-password" element={<Layout><ResetPassword /></Layout>} />
        <Route path="/courses" element={<Layout><CourseCatalog /></Layout>} />
        <Route path="/courses/:id" element={<Layout><CourseDetail /></Layout>} />

        {/* Protected routes */}
        <Route path="/courses/:id/registered" element={<ProtectedRoute><Layout><StudentCourseView /></Layout></ProtectedRoute>} />
        <Route path="/courses/:id/registered/sections/:sectionId" element={<ProtectedRoute><Layout><StudentSectionView /></Layout></ProtectedRoute>} />
        <Route path="/courses/:id/registered/assessments/:assessmentId" element={<ProtectedRoute><Layout><AssessmentAttempt /></Layout></ProtectedRoute>} />
        <Route path="/courses/:id/registered/assessments/:assessmentId/results" element={<ProtectedRoute><Layout><AssessmentResult /></Layout></ProtectedRoute>} />
        <Route path="/courses/:id/manage" element={<ProtectedRoute><Layout><CourseEditor /></Layout></ProtectedRoute>} />
        <Route path="/courses/:id/manage/sections/:sectionId" element={<ProtectedRoute><Layout><SectionEditor /></Layout></ProtectedRoute>} />
        <Route path="/courses/:id/manage/assessments/:assessmentId" element={<ProtectedRoute><Layout><AssessmentEditor /></Layout></ProtectedRoute>} />
        <Route path="/courses/:id/manage/assessments/:assessmentId/submissions" element={<ProtectedRoute><Layout><AssessmentSubmissions /></Layout></ProtectedRoute>} />
        <Route path="/courses/:id/manage/members" element={<ProtectedRoute><Layout><CourseMembers /></Layout></ProtectedRoute>} />
        <Route path="/courses/:id/clone" element={<ProtectedRoute><Layout><CloneCourse /></Layout></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/social" element={<ProtectedRoute><Layout><Community /></Layout></ProtectedRoute>} />
        <Route path="/social/messages" element={<ProtectedRoute><Layout><Messaging /></Layout></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
        <Route path="/create-course" element={<ProtectedRoute><Layout><CreateCourse /></Layout></ProtectedRoute>} />
        <Route path="/change-password" element={<ProtectedRoute><Layout><ChangePassword /></Layout></ProtectedRoute>} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
