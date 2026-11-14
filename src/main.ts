import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .then(() => {
    const preloader = document.getElementById('app-preloader');
    if (!preloader) return;
    preloader.classList.add('app-preloader--done');
    setTimeout(() => preloader.remove(), 500);
  })
  .catch((err) => console.error(err));
