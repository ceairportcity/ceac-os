import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {minifyProductionCss} from "./scripts/build/production-css.mjs";

export default defineConfig({
  plugins: [react(), {
    name: "ceac-final-css-optimisation",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      // Optimise complete CSS chunks so rules shared across source stylesheets
      // can be merged. Keep all runtime CSS in its existing stylesheet assets.
      for (const asset of Object.values(bundle)) {
        if (asset.type === "asset" && asset.fileName.endsWith(".css"))
          asset.source = minifyProductionCss(String(asset.source));
      }
    },
  }],
  build: {
    // Vite converts legacy media queries to ranges; CSSO 5 drops those rules.
    // Run the final compressor once on the original, supported query syntax.
    cssMinify: false,
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
