{{- define "bee-pi-agent.name" -}}
{{- required "agent.name is required" .Values.agent.name -}}
{{- end -}}

{{- define "bee-pi-agent.serviceAccountName" -}}
{{- default (include "bee-pi-agent.name" .) .Values.serviceAccount.name -}}
{{- end -}}

{{- define "bee-pi-agent.claimName" -}}
{{- default (printf "%s-workspace" (include "bee-pi-agent.name" .)) .Values.workspace.claimName -}}
{{- end -}}

{{- define "bee-pi-agent.configName" -}}
{{- default (printf "%s-config" (include "bee-pi-agent.name" .)) .Values.config.name -}}
{{- end -}}

{{- define "bee-pi-agent.containerName" -}}
{{- default (include "bee-pi-agent.name" .) .Values.container.name -}}
{{- end -}}

{{- define "bee-pi-agent.workDir" -}}
{{- $mountPath := .Values.workspace.mountPath -}}
{{- if .Values.git.repoUrl -}}
{{- printf "%s/%s" $mountPath .Values.git.targetDir -}}
{{- else -}}
{{- $mountPath -}}
{{- end -}}
{{- end -}}
