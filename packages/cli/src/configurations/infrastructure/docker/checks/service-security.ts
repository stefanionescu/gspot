import { isMap, isScalar, isSeq, LineCounter, type Node, parseDocument, type YAMLMap } from 'yaml';

import { SERVICE_SECURITY_MESSAGES, SERVICE_SECURITY_RULES } from '#cli/config/configurations/docker.ts';
import { SERVICE_SECURITY_EXPLANATIONS } from '#cli/configurations/infrastructure/docker/explanations.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

const DOCKER_SOCKET = /docker\.sock(?::|$)/u;

const UNCONFINED_OPTION = /^(?:(?:seccomp|apparmor)[:=]unconfined|label[:=]disable)$/u;

type ComposeHit = { kind: keyof typeof SERVICE_SECURITY_RULES; node: Node };

function listVolumeHits(volumes: unknown): ComposeHit[] {
    if (!isSeq(volumes)) return [];
    return volumes.items.flatMap((volume) => {
        const source = isMap(volume) ? volume.get('source', true) : volume;
        return isScalar(source) && DOCKER_SOCKET.test(String(source.value))
            ? [{ kind: 'dockerSocket' as const, node: source }]
            : [];
    });
}

function listServiceHits(service: YAMLMap): ComposeHit[] {
    const privileged = service.get('privileged', true);
    const options = service.get('security_opt', true);
    return [
        ...(isScalar(privileged) && privileged.value === true
            ? [{ kind: 'privileged' as const, node: privileged }]
            : []),
        ...listVolumeHits(service.get('volumes', true)),
        ...(isSeq(options)
            ? options.items.flatMap((option) =>
                  isScalar(option) && UNCONFINED_OPTION.test(String(option.value))
                      ? [{ kind: 'unconfined' as const, node: option }]
                      : [],
              )
            : []),
    ];
}

/**
Report each Compose service that runs privileged, mounts the Docker socket, or turns off a confinement profile. A file
that does not parse gets no finding here, and docker/compose reports it.
*/
function checkServiceSecurity(session: Session, planned: PlannedCheck): CheckFinding[] {
    return planned.files.flatMap(({ path }) => {
        const lines = new LineCounter();
        const document = parseDocument(readText(session.cache, path), { lineCounter: lines });
        const services = document.errors.length > 0 ? undefined : document.get('services', true);
        if (!isMap(services)) return [];
        return services.items
            .flatMap(({ value }) => (isMap(value) ? listServiceHits(value) : []))
            .map(({ kind, node }) => ({
                file: path,
                line: lines.linePos(node.range?.[0] ?? 0).line,
                rule: SERVICE_SECURITY_RULES[kind],
                message: SERVICE_SECURITY_MESSAGES[kind],
            }));
    });
}

export const DOCKER_SERVICE_SECURITY_CHECKS: Readonly<Record<string, CheckCode>> = {
    'docker/service-security': { check: checkServiceSecurity, explanations: SERVICE_SECURITY_EXPLANATIONS },
};
