import { Outlet } from 'react-router-dom'
import { StudentSidebar } from './StudentSidebar'

export function StudentLayout() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <StudentSidebar />
      <main className="flex-1 bg-[#F1F5F9] p-4 sm:p-6 md:p-8 lg:p-10">
        <Outlet />
      </main>
    </div>
  )
}
