import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from './components/layout/MainLayout'
import { RegistryLayout } from './components/layout/RegistryLayout'
import { AdminLayout } from './components/layout/AdminLayout'
import { StudentLayout } from './components/layout/StudentLayout'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { HomePage } from './pages/HomePage'
import { VerifyDegreePage } from './pages/VerifyDegreePage'
import { VerifyResultPage } from './pages/VerifyResultPage'
import { LoginSignupPage } from './pages/LoginSignupPage'
import { AdminLoginPage } from './pages/AdminLoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SkeletonLines } from './components/ui'

const lazyRegistry = (name) =>
  lazy(() => import(`./pages/registry/${name}.jsx`).then((m) => ({ default: m[name] })))
const RegistryHomePage = lazyRegistry('RegistryHomePage')
const RegistryRegisterPage = lazyRegistry('RegistryRegisterPage')
const RegistryVerifyEmailPage = lazyRegistry('RegistryVerifyEmailPage')
const RegistryAdminPage = lazyRegistry('RegistryAdminPage')

const AdminStudentsPage = lazy(() =>
  import('./pages/AdminStudentsPage').then((m) => ({ default: m.AdminStudentsPage })),
)
const IssueDegreePage = lazy(() =>
  import('./pages/IssueDegreePage').then((m) => ({ default: m.IssueDegreePage })),
)
const IssuedCertificatesPage = lazy(() =>
  import('./pages/IssuedCertificatesPage').then((m) => ({ default: m.IssuedCertificatesPage })),
)
const AuditLogsPage = lazy(() =>
  import('./pages/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })),
)
const StudentDashboardPage = lazy(() =>
  import('./pages/student/StudentDashboardPage').then((m) => ({ default: m.StudentDashboardPage })),
)
const MyCertificatesPage = lazy(() =>
  import('./pages/student/MyCertificatesPage').then((m) => ({ default: m.MyCertificatesPage })),
)
const StudentCertificateDetailPage = lazy(() =>
  import('./pages/student/StudentCertificateDetailPage').then((m) => ({ default: m.StudentCertificateDetailPage })),
)
const StudentProfilePage = lazy(() =>
  import('./pages/student/StudentProfilePage').then((m) => ({ default: m.StudentProfilePage })),
)

function PortalFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <div className="w-full max-w-md rounded-xl border border-surface-line bg-white p-8">
        <SkeletonLines lines={4} />
      </div>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/verify" element={<VerifyDegreePage />} />
        <Route path="/verify/:certificateNumber" element={<VerifyResultPage />} />
        <Route path="/login" element={<LoginSignupPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="/registry" element={<RegistryLayout />}>
        {[
          [undefined, RegistryHomePage],
          ['register', RegistryRegisterPage],
          ['verify-email', RegistryVerifyEmailPage],
          ['admin', RegistryAdminPage],
          ['admin/login', RegistryAdminPage],
        ].map(([path, Page]) => (
          <Route
            key={path ?? 'index'}
            index={path === undefined}
            path={path}
            element={
              <Suspense fallback={<PortalFallback />}>
                <Page />
              </Suspense>
            }
          />
        ))}
      </Route>
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/admin/issue-degree" replace />} />
        <Route
          path="students"
          element={
            <Suspense fallback={<PortalFallback />}>
              <AdminStudentsPage />
            </Suspense>
          }
        />
        <Route
          path="issue-degree"
          element={
            <Suspense fallback={<PortalFallback />}>
              <IssueDegreePage />
            </Suspense>
          }
        />
        <Route
          path="issued-certificates"
          element={
            <Suspense fallback={<PortalFallback />}>
              <IssuedCertificatesPage />
            </Suspense>
          }
        />
        <Route
          path="audit-logs"
          element={
            <Suspense fallback={<PortalFallback />}>
              <AuditLogsPage />
            </Suspense>
          }
        />
      </Route>
      <Route
        path="/student"
        element={
          <ProtectedRoute role="STUDENT">
            <StudentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/student/dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <Suspense fallback={<PortalFallback />}>
              <StudentDashboardPage />
            </Suspense>
          }
        />
        <Route
          path="certificates"
          element={
            <Suspense fallback={<PortalFallback />}>
              <MyCertificatesPage />
            </Suspense>
          }
        />
        <Route
          path="certificates/:id"
          element={
            <Suspense fallback={<PortalFallback />}>
              <StudentCertificateDetailPage />
            </Suspense>
          }
        />
        <Route
          path="profile"
          element={
            <Suspense fallback={<PortalFallback />}>
              <StudentProfilePage />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  )
}

export default App
