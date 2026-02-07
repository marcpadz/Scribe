import { Project, User } from "../types";

// Note: In a real production app, these would be in environment variables
// You must set REACT_APP_GOOGLE_CLIENT_ID and API_KEY in your env
// For this environment, we assume they are provided via process.env or similar injection
const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || ''; 
const API_KEY = process.env.API_KEY || '';
const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile";

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export const initGoogleServices = (): Promise<void> => {
  return new Promise((resolve) => {
    const checkInit = () => {
       if ((window as any).gapi && (window as any).google) {
          (window as any).gapi.load('client', async () => {
             try {
                 // Initialize the client with API key only first
                 if (API_KEY) {
                    await (window as any).gapi.client.init({
                        apiKey: API_KEY,
                    });
                 }
                 
                 // Explicitly load the Drive API v3
                 await (window as any).gapi.client.load('drive', 'v3');
                 
                 gapiInited = true;
             } catch (error) {
                 console.error("GAPI init failed", error);
             }
             
             try {
                 if (CLIENT_ID) {
                     tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
                        client_id: CLIENT_ID,
                        scope: SCOPES,
                        callback: '', // defined at request time
                     });
                     gisInited = true;
                 } else {
                     console.warn("Skipping GIS Init: REACT_APP_GOOGLE_CLIENT_ID is missing");
                 }
             } catch (error) {
                 console.error("GIS init failed", error);
             }

             resolve();
          });
       } else {
         setTimeout(checkInit, 100);
       }
    };
    checkInit();
  });
};

export const handleGoogleLogin = (): Promise<User> => {
  return new Promise((resolve, reject) => {
    if (!CLIENT_ID) {
        reject("Google Client ID is not configured. Please set REACT_APP_GOOGLE_CLIENT_ID in your environment.");
        return;
    }

    if (!tokenClient) {
        reject("Google Services not initialized. Check console for initialization errors.");
        return;
    }

    tokenClient.callback = async (resp: any) => {
      if (resp.error) {
        reject(resp);
        return;
      }
      
      // Fetch user profile
      try {
         const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${resp.access_token}` }
         }).then(r => r.json());
         
         resolve({
            name: userInfo.name,
            email: userInfo.email,
            picture: userInfo.picture,
            accessToken: resp.access_token
         });
      } catch (err) {
         reject(err);
      }
    };

    if ((window as any).gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
      tokenClient.requestAccessToken({prompt: ''});
    }
  });
};

export const saveToDrive = async (project: Project, accessToken: string): Promise<string> => {
    const fileContent = JSON.stringify(project);
    const file = new Blob([fileContent], { type: 'application/json' });
    const metadata = {
        name: `${project.name}.neoscriber`,
        mimeType: 'application/json',
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
        body: form,
    });
    
    if (!res.ok) {
        throw new Error(`Drive Upload Failed: ${res.statusText}`);
    }
    
    const data = await res.json();
    return data.id;
};

export const loadFromDrive = async (fileId: string, accessToken: string): Promise<Project> => {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { 'Authorization': 'Bearer ' + accessToken },
    });
    
    if (!res.ok) throw new Error("Failed to load file from Drive");
    return await res.json();
};

export const listDriveProjects = async (accessToken: string): Promise<any[]> => {
    // Query for files with our extension
    const q = "name contains '.neoscriber' and trashed = false";
    try {
        const res = await (window as any).gapi.client.drive.files.list({
            pageSize: 10,
            fields: 'nextPageToken, files(id, name)',
            q: q
        });
        return res.result.files || [];
    } catch (e) {
        console.error("Error listing drive files", e);
        throw e;
    }
};