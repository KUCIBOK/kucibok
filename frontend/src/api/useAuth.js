import { jwtDecode } from "jwt-decode";
import { MetaMaskSDK } from "@metamask/sdk";
import { utils } from "./useAPI";
const { api, options } = utils;

//Login ✅
export async function loginUser(email, password) {
  try {
    const response = await fetch(`${api}/auth/login`, {
      ...options,
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (response.status === 409) {
      return { error: "L'utilisateur existe déjà. Essayez de vous connecter." };
    }

    const data = await response.json();

    if (data?.token && data?.user) {
      // ⚡ utilise user renvoyé par le backend (avec likedArtworks inclus)
      const user = { ...data.user, token: data.token };

      // sécurisation (id + role)
      if (user?.role || user?._id) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("likedArtworks", JSON.stringify(user.likedArtworks));
        return {
          user,
          artist: data?.artist,
          profile: data?.profile,
          likedArtworks: user?.likedArtworks || [], // ici ça marchera ✅
        };
      }
    }

    localStorage.removeItem("token");
    return { error: data?.message };
  } catch (error) {
    return { error: error?.message };
  }
}

export async function getMetamaskAddress() {
  try {
    const MMSDK = new MetaMaskSDK({
      dappMetadata: {
        name: "kucibok.com",
        url: window.location.href,
        logging: { developerMode: false },
        checkInstallationImmediately: false,
        preferDesktop: false,
      },
    });
    // Connect and get accounts
    const accounts = await MMSDK.connect();

    // Get provider for RPC requests
    const provider = MMSDK.getProvider();

    // Make an RPC request
    const address = await provider.request({
      method: "eth_accounts",
      params: [],
    });
    const message = "Connexion à Kucibok";
    if (address) {
      const signature = await MMSDK.connectAndSign({
        msg: message,
      });
      const credentials = {
        address: address[0],
        signature: signature,
        message: message,
      };
      return credentials;
    }
  } catch (error) {
    return {
      error: error?.message,
    };
  }
}

export async function MetamaskLogin(payload) {
  //✅
  try {
    const response = await fetch(`${api}/auth/login-metamask`, {
      ...options,
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (data?.token) {
      const decoded = jwtDecode(data?.token);
      const user = { ...decoded };
      if (user?.role || user?._id) {
        localStorage.setItem("token", data?.token);
        return {
          user: user,
          artist: data?.artist,
          profile: data?.profile,
        };
      }
    }
    return {
      error: data?.message || data?.error,
    };
  } catch (error) {
    return {
      error: error?.message,
    };
  }
}

export async function verifyEmail(token) {
  try {
    const response = await fetch(`${api}/auth/verify-email/${token}`, {
      ...options,
    });
    const data = await response.json();
    if (data?.token) {
      const payload = jwtDecode(data?.token);
      const user = { ...payload, token: data?.token };
      if (user?.role || user?._id) {
        localStorage.setItem("token", data?.token);
        return {
          user: user,
          artist: data?.artist,
          profile: data?.profile,
        };
      }
    }
    return {
      error: data?.message || "Erreur lors de la vérification de l'email.",
    };
  } catch (error) {
    return {
      error: error?.message,
    };
  }
}

export async function MetamaskSignUp(payload) {
  try {
    const response = await fetch(`${api}/auth/signup-metamask`, {
      ...options,
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (data?.token) {
      const decoded = jwtDecode(data?.token);
      const user = { ...decoded };
      if (user?.role || user?._id) {
        localStorage.setItem("token", data?.token);
        return {
          user: user,
          artist: data?.artist,
          profile: data?.profile,
        };
      }
    }
    return {
      error: data?.message || data?.error,
    };
  } catch (error) {
    return {
      error: error?.message,
    };
  }
}

export async function SignUpUser(charge) {
  //✅
  try {
    const formData = new FormData();
    let response;
    if (charge?.role == "artist" && charge?.image) {
      Object.keys(charge).forEach((key) => {
        formData.append(key, charge[key]);
      });
      response = await fetch(`${api}/auth/register`, {
        headers: {
          "kcb-api-key": import.meta.env.VITE_API_KEY,
          Accept: "*/*",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        method: "POST",
        body: formData,
      });
    } else {
      response = await fetch(`${api}/auth/register`, {
        ...options,
        method: "POST",
        body: JSON.stringify(charge),
      });
    }
    const data = await response.json();
    if (response.status === 409) {
      return {
        error: "L'utilisateur existe déjà. Essayez de vous connecter.",
      };
    }
    if (data?.user?._id) {
      const user = data?.user;
      if (user?.role || user?._id) {
        return {
          user: user,
          message:
            "Inscription réussie. Vérifiez votre adresse email pour continuer.",
        };
      }
    }
    return {
      error: data?.message,
    };
  } catch (error) {
    return {
      error: error?.message,
    };
  }
}

export async function getUserProfile(id) {
  //✅
  try {
    const response = await fetch(`${api}/profile/${id}`, {
      ...options,
    });
    const data = await response.json();
    if (data?._id) {
      return data;
    }
    return {
      error: data?.message,
    };
  } catch (error) {
    return {
      error: error.message,
    };
  }
}

export async function getUserById(id) {
  try {
    const response = await fetch(`${api}/auth/${id}`, {
      ...options,
    });
    const data = await response.json();
    if (data?._id) {
      return data;
    }
    return {
      error: data?.message,
    };
  } catch (error) {
    return {
      error: error.message,
    };
  }
}

export async function updateUser(id, payload) {
  //✅
  try {
    const response = await fetch(`${api}/auth/${id}`, {
      ...options,
      method: "PUT",
      body: JSON.stringify({
        ...payload,
      }),
    });
    const user = await response.json();
    if (user?.role || user?._id) {
      return user;
    }
    return {
      error: user?.message,
    };
  } catch (error) {
    return {
      error: error.message,
    };
  }
}

export async function updateProfile(id, payload) {
  //✅
  try {
    const response = await fetch(`${api}/profile/${id}`, {
      method: "PUT",
      headers: {
        "kcb-api-key": import.meta.env.VITE_API_KEY,
        Accept: "*/*",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: payload,
    });
    const profile = await response.json();
    if (profile?.userId) {
      return profile;
    }
    return {
      error: profile?.error || profile?.message,
    };
  } catch (error) {
    return {
      error: error.message,
    };
  }
}

export async function changePassword(payload) {
  try {
    const { api, options } = utils;
    const response = await fetch(`${api}/auth/change-password`, {
      ...options,
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const user = await response.json();
    if (user?._id) {
      return user;
    }
    return {
      error: user?.error || user?.message,
    };
  } catch (error) {
    return { error: error.message };
  }
}

export async function forgotPassword(payload) {
  try {
    const { api, options } = utils;
    const response = await fetch(`${api}/auth/forgot-password`, {
      ...options,
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (response.status == 200) {
      return {
        ...data,
        ok: true,
      };
    }
    return {
      error: data?.error || data?.message,
    };
  } catch (error) {
    return {
      error: error.message,
    };
  }
}

export async function resetPassword(payload) {
  try {
    const { api, options } = utils;
    const response = await fetch(`${api}/auth/reset-password`, {
      ...options,
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (response.status == 200) {
      return {
        ...data,
        ok: true,
      };
    }
    return {
      error: data?.error || data?.message,
    };
  } catch (error) {
    return {
      error: error.message,
    };
  }
}
