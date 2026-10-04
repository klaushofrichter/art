# Sourced by pull-assets.sh and sync-assets.sh, not run on its own.
#
# The art-content deployment is the one pod allowed to write to the content
# volume, and it sleeps at zero replicas. wake_content_pod scales it up, waits
# for it, sets POD, and arranges for it to go back to sleep when the calling
# script exits, however it exits. Both scripts carried their own copy of this,
# which had to agree on the name, the label, the timeout and the scale-down.
#
# A caller that needs its own cleanup on exit adds it with on_exit rather than
# replacing the trap, which would leave the pod running.

NS=art
DEPLOY=art-content
KUBECTL="${KUBECTL:-kubectl}"

_exit_steps=()
on_exit() { _exit_steps+=("$1"); }
_run_exit_steps() {
  local step
  for step in "${_exit_steps[@]+"${_exit_steps[@]}"}"; do eval "$step"; done
}
trap _run_exit_steps EXIT

wake_content_pod() {
  echo "==> waking $DEPLOY"
  on_exit 'echo "==> sending $DEPLOY back to sleep"; $KUBECTL scale deploy/$DEPLOY -n $NS --replicas=0 >/dev/null'
  $KUBECTL scale deploy/$DEPLOY -n $NS --replicas=1 >/dev/null
  $KUBECTL rollout status deploy/$DEPLOY -n $NS --timeout=120s >/dev/null
  POD=$($KUBECTL get pod -n $NS -l app=$DEPLOY -o jsonpath='{.items[0].metadata.name}')
}
