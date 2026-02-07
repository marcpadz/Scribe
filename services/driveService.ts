import { Project, User } from "../types";

// Note: In a real production app, these would be in environment variables
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
                 if (API_KEY) {
                    await (window as any).gapi.client.init({ apiKey: API_KEY });
                 }
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
        reject("Google Client ID is not configured.");
        return;
    }

    if (!tokenClient) {
        reject("Google Services not initialized.");
        return;
    }

    tokenClient.callback = async (resp: any) => {
      if (resp.error) {
        reject(resp);
        return;
      }
      
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

// --- Drive File Operations ---

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
    size?: string;
    thumbnailLink?: string;
}

export const searchDriveFiles = async (accessToken: string, mode: 'project' | 'media'): Promise<DriveFile[]> => {
    let q = "trashed = false";
    
    if (mode === 'project') {
        // Look for our specific JSON files
        q += " and (name contains '.neoscriber' or mimeType = 'application/json')";
    } else {
        // Look for Audio or Video
        q += " and (mimeType contains 'audio/' or mimeType contains 'video/')";
    }

    const params = new URLSearchParams({
        pageSize: '20',
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, thumbnailLink)',
        q: q,
        orderBy: 'modifiedTime desc'
    });

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
        headers: { 'Authorization': 'Bearer ' + accessToken },
    });
    
    if (!res.ok) throw new Error("Failed to search Drive");
    const data = await res.json();
    return data.files || [];
};

export const getDriveFileContent = async (fileId: string, accessToken: string): Promise<Blob> => {
     const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { 'Authorization': 'Bearer ' + accessToken },
    });
    if (!res.ok) throw new Error("Failed to download file");
    return await res.blob();
};

export const createDriveFile = async (accessToken: string, name: string, content: Blob): Promise<string> => {
    const metadata = { 
        name, 
        mimeType: 'application/json' 
    };
    
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', content);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + accessToken },
        body: form
    });
    
    if (!res.ok) throw new Error("Failed to create file");
    const data = await res.json();
    return data.id;
};

export const updateDriveFile = async (accessToken: string, fileId: string, content: Blob): Promise<void> => {
     const form = new FormData();
     // We only update content here, metadata can be added if needed
     form.append('file', content);

     const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + accessToken },
        body: form
    });
    
    if (!res.ok) throw new Error("Failed to update file");
};