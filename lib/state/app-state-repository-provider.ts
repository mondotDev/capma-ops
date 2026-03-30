import type { AppStateRepository } from "@/lib/state/app-state-repository";
import { localAppStateRepository } from "@/lib/state/local-app-state-repository";

let appStateRepository: AppStateRepository = localAppStateRepository;

export function getAppStateRepository(): AppStateRepository {
  return appStateRepository;
}

export function setAppStateRepository(repository: AppStateRepository) {
  appStateRepository = repository;
}
