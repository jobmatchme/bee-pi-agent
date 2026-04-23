{{- define "fabee-pi-agent.name" -}}
{{- required "agent.name is required" .Values.agent.name -}}
{{- end -}}

{{- define "fabee-pi-agent.serviceAccountName" -}}
{{- default (include "fabee-pi-agent.name" .) .Values.serviceAccount.name -}}
{{- end -}}

{{- define "fabee-pi-agent.claimName" -}}
{{- default (printf "%s-workspace" (include "fabee-pi-agent.name" .)) .Values.workspace.claimName -}}
{{- end -}}

{{- define "fabee-pi-agent.configName" -}}
{{- default (printf "%s-config" (include "fabee-pi-agent.name" .)) .Values.config.name -}}
{{- end -}}

{{- define "fabee-pi-agent.containerName" -}}
{{- default (include "fabee-pi-agent.name" .) .Values.container.name -}}
{{- end -}}

{{- define "fabee-pi-agent.workDir" -}}
{{- $mountPath := .Values.workspace.mountPath -}}
{{- if .Values.git.repoUrl -}}
{{- printf "%s/%s" $mountPath .Values.git.targetDir -}}
{{- else -}}
{{- $mountPath -}}
{{- end -}}
{{- end -}}
