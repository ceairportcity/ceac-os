#!/usr/bin/env bash
set -euo pipefail

scope="${1:-full}"

case "$scope" in
  p1-design)
    tests=(tests/stage2-p1-connected-review.spec.js)
    ;;
  vf9b)
    tests=(
      tests/visual-fidelity-css-cascade-closure.spec.js
      tests/experience-v2-shell*.spec.js
      tests/guide-adoption.spec.js
      tests/role-routing.spec.js
    )
    ;;
  vf9c)
    tests=(tests/visual-fidelity-performance-closure.spec.js tests/role-routing.spec.js)
    ;;
  vf9d)
    tests=(tests/visual-fidelity-state-closure.spec.js tests/experience-v2-interactions.spec.js tests/role-routing.spec.js)
    ;;
  stage15)
    tests=(
      tests/experience-v2-stage15-*.spec.js
      tests/experience-v2-shell*.spec.js
      tests/experience-v2-stage14-routes.spec.js
      tests/premium-redesign-r7.spec.js
      tests/visual-parity-all-pages.spec.js
      tests/role-routing.spec.js
    )
    ;;
  stage14)
    tests=(tests/experience-v2-stage14-*.spec.js tests/role-routing.spec.js)
    ;;
  finance)
    tests=(tests/experience-v2-finance-*.spec.js tests/role-routing.spec.js)
    ;;
  workforce)
    tests=(tests/experience-v2-workforce-*.spec.js tests/role-routing.spec.js)
    ;;
  project)
    tests=(tests/experience-v2-project-family.spec.js tests/role-routing.spec.js)
    ;;
  people)
    tests=(tests/experience-v2-people-family.spec.js tests/role-routing.spec.js)
    ;;
  work)
    tests=(tests/experience-v2-work-family.spec.js tests/role-routing.spec.js)
    ;;
  reports)
    tests=(tests/experience-v2-reports-manager.spec.js tests/role-routing.spec.js)
    ;;
  personal)
    tests=(tests/experience-v2-personal-*.spec.js tests/role-routing.spec.js)
    ;;
  shell)
    tests=(
      tests/experience-v2-components.spec.js
      tests/experience-v2-interactions.spec.js
      tests/experience-v2-shell*.spec.js
      tests/role-routing.spec.js
    )
    ;;
  *)
    tests=(tests/*.spec.js)
    ;;
esac

echo "Level A browser scope: $scope"
npx playwright test "${tests[@]}"
