import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as prompts from '@clack/prompts';
import * as color from 'picocolors';
import {
  getAppDir,
  updatePackageJson,
  removeDownloadedApps,
  APPS_ENGINE_DIR,
} from '../utils/apps';
import { experiences } from './experiences';

function generateNavbarExperiencesList(projectDir: string, experiences) {
  const filePath = path.join(projectDir, '/web/src/components/layout/header/Experiences.tsx');
  const content = `
import { ListItem } from './ListItem';

export function Experiences() {
  return (
    <>
${experiences.map(({ value, label }) => (
    `      <ListItem href="/${value}">${label}</ListItem>`
  )).join('\n')}
    </>
  );
}
`
  fs.writeFileSync(filePath, content);
};

async function execAsync(command: string, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout) => {
      if (error) {
        reject(error);
      }
      resolve(stdout);
    });
  });
}

function setupBlankApp(projectDir: string) {
  const appPath = path.join(projectDir, './web/app/page.tsx');

  const content = `/**
 * Server component, which imports the Home component (client component that has 'use client' in it)
 * https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts
 * https://nextjs.org/docs/pages/building-your-application/upgrading/app-router-migration#step-4-migrating-pages
 * https://nextjs.org/docs/app/building-your-application/rendering/client-components
 */
export default function Page() {
  return <div>Hello World</div>;
}
`;
  fs.writeFileSync(appPath, content);
}

export async function setupProject(projectDir: string, project) {
  try {
    const spinner = prompts.spinner();

    spinner.start('Downloading coinbase/build-onchain-apps');

    removeDownloadedApps(APPS_ENGINE_DIR);

    // Download the app from github.com/coinbase/build-onchain-apps/apps and extract it
    await execAsync(
      'git clone https://github.com/coinbase/build-onchain-apps temp-build-onchain-apps'
    );

    fs.cpSync(getAppDir(), projectDir, {
      recursive: true,
    });

    removeDownloadedApps(APPS_ENGINE_DIR);

    await execAsync('git init', { cwd: projectDir, stdio: 'ignore' });

    removeDownloadedApps(projectDir + '/contracts/lib/openzeppelin-contracts');
    removeDownloadedApps(projectDir + '/contracts/lib/forge-std');
    removeDownloadedApps(projectDir + '/contracts/lib/ERC721A');
    removeDownloadedApps(projectDir + '/contracts/lib/solady');
    removeDownloadedApps(projectDir + '/contracts/lib/murky');

    spinner.message(
      'git submodule add https://github.com/openzeppelin/openzeppelin-contracts'
    );
    await execAsync(
      'git submodule add https://github.com/openzeppelin/openzeppelin-contracts contracts/lib/openzeppelin-contracts',
      {
        cwd: projectDir,
      }
    );

    spinner.message(
      'git submodule add https://github.com/foundry-rs/forge-std'
    );
    await execAsync(
      'git submodule add https://github.com/foundry-rs/forge-std contracts/lib/forge-std',
      {
        cwd: projectDir,
      }
    );

    spinner.message(
      'git submodule add https://github.com/chiru-labs/ERC721A'
    );
    await execAsync(
      'git submodule add https://github.com/chiru-labs/ERC721A contracts/lib/ERC721A',
      {
        cwd: projectDir,
      }
    );

    spinner.message(
      'git submodule add https://github.com/vectorized/solady'
    );
    await execAsync(
      'git submodule add https://github.com/vectorized/solady contracts/lib/solady',
      {
        cwd: projectDir,
      }
    );

    spinner.message(
      'git submodule add https://github.com/dmfxyz/murky'
    );
    await execAsync(
      'git submodule add https://github.com/dmfxyz/murky contracts/lib/murky',
      {
        cwd: projectDir,
      }
    );

    const isWebPackageJsonUpdated = updatePackageJson(
      projectDir + '/web',
      project.name
    );

    if (!isWebPackageJsonUpdated) {
      prompts.log.error(color.red('Error updating project package.json'));
      process.exit(1);
    }

    if (project.selectedModules.length === 0) {
      removeDownloadedApps(projectDir + '/web/app/buy-me-coffee');
      removeDownloadedApps(projectDir + '/web/app/mint');
      removeDownloadedApps(projectDir + '/web/app/home');
      removeDownloadedApps(projectDir + '/web/src/experiences');

      setupBlankApp(projectDir);
    } else {
      if (!project.selectedModules.includes('buy-me-coffee')) {
        removeDownloadedApps(projectDir + '/web/app/buy-me-coffee');
      }

      if (!project.selectedModules.includes('mint')) {
        removeDownloadedApps(projectDir + '/web/app/mint');
      }

      const selectedExperiences = experiences.filter(({ value }) => project.selectedModules.includes(value));

      generateNavbarExperiencesList(projectDir, selectedExperiences);
    }

    await execAsync('git add .', { cwd: projectDir, stdio: 'ignore' });
    await execAsync('git commit -m "initalized with build-onchain-apps"', { cwd: projectDir, stdio: 'ignore' });

    spinner.stop(`Onchain app ${project.name} created successfully! 🚀`);
  } catch (e) {
    console.error(e);
    prompts.log.error(color.red('Error initializing Git and Foundry'));
    process.exit(1);
  }
}
