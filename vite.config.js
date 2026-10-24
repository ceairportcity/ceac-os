import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Dynamic module-preload links do not inherit a hash-authorised script's
    // CSP trust. Native module imports preserve on-demand loading without
    // creating those unapproved preload requests.
    modulePreload: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Keep existing Workforce interactions intact while splitting its
            // schedule/evidence components below the fixed 100KiB route cap.
            {
              name: "workforce-workspace",
              test: /src[\\/]components[\\/](?:WorkforceEmployeeScheduleWorkspace|WorkforceTodayReviewList|AttendanceCorrectionWorkflow|AttendanceCodeIssuer)\.jsx$/,
              priority: 9,
              maxSize: 72 * 1024,
            },
            // Stage 2 expanded People with HR create/edit, versioned schedules,
            // account reconciliation and private dossier interactions. Keep
            // these existing modules in small eagerly imported, reusable chunks
            // without changing route behavior, security or a 100KiB JS budget.
            {
              name: "people-hr-workspace",
              test: /src[\\/]components[\\/](?:PeopleAccess|EmployeeScheduleEditor|RosterOnlyEmploymentEditor|LinkedEmployeeContactEditor|RosterAccountLink|HRCreateRosterEmployee|EmployeeDossierRecords|EmployeeAttendanceObservations|SupportTeamMemberships|VolunteerActivationApprovals)\.jsx$/,
              priority: 8,
              maxSize: 72 * 1024,
            },
            { name: "react-vendor", test: /node_modules[\\/](react|react-dom)[\\/]/, priority: 40 },
            { name: "supabase-vendor", test: /node_modules[\\/]@supabase[\\/]/, priority: 30 },
            { name: "motion-vendor", test: /node_modules[\\/]motion[\\/]/, priority: 20 },
            { name: "icons-vendor", test: /node_modules[\\/]lucide-react[\\/]/, priority: 15 },
            { name: "vendor", test: /node_modules/, priority: 10, maxSize: 300 * 1024 },
          ],
        },
      },
    },
  },
});
