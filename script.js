// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDh3vnkEunlFiChuCRo0Q--r7RsOEXeovA",
    authDomain: "blogtopia-1.firebaseapp.com",
    projectId: "blogtopia-1",
    storageBucket: "blogtopia-1.appspot.com",
    messagingSenderId: "357738165536",
    appId: "1:357738165536:web:85b6f026bd8f3cff69d345",
    measurementId: "G-7W90737FRH"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
console.log("Firebase initialized with storage:", storage);

firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
        console.log("Auth persistence set to LOCAL");
        // Existing authentication code...
    })
    .catch((error) => {
        console.error("Error setting auth persistence:", error);
    });

firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log("User is signed in:", user.uid);
        currentUser = user;
        setupFavorites();
        loadPosts();
    } else {
        console.log("No user signed in");
        currentUser = null;
        favorites = [];
        updateFavoritesUI();
    }
});

let currentUser = null;
let posts = [];
let favorites = [];
let currentPostId = null;
let quill = null;

document.addEventListener("DOMContentLoaded", function () {
    setupAuthObserver();
    const path = window.location.pathname;
    if (path.endsWith('/') || path.endsWith('index.html')) {
        loadPosts();
        setupFilterListeners();
        setupSearchFunctionality();
    } else if (path.endsWith('admin.html')) {
        // We'll handle this in the auth observer
    } else if (path.endsWith('add.html')) {
        setupAddPostForm();
    } else if (path.endsWith('post-details.html')) {
        loadPostDetails();
        setupEditPostForm();
    } else if (path.endsWith('user-profile.html')) {
        loadUserProfile();
    }
    if (currentUser) {
        console.log("Loading favorites on page init");
        setupFavorites();
    }
    if (window.location.pathname.endsWith('user-profile.html')) {
        loadUserProfile();
    } else {
        console.log("No user logged in, skipping favorites load");
    }
    startOnboardingTour();
    setupHeaderScroll();
    setupAuthButtons();
    setupFilterListeners();
    // Initial route handling
});


function setupAuthObserver() {
    firebase.auth().onAuthStateChanged((user) => {
        console.log("Auth state changed. User:", user);
        console.log("Current path:", window.location.pathname);

        currentUser = user;

        // Check if we're on the index page and user is signed in
        if (user && (window.location.pathname === '/' || window.location.pathname.endsWith('/index.html'))) {
            console.log("Redirecting to bloggywave.html");
            window.location.href = '/bloggywave.html';
            return; // Exit the function early to prevent unnecessary operations
        }

        updateUI();
        setupFavorites();
        if (document.getElementById("posts")) {
            loadPosts();
        }
        if (window.location.pathname.endsWith('admin.html')) {
            loadAdminPage();
        }
        if (window.location.pathname.endsWith('post-details.html')) {
            checkPostOwnership();
        }
    });
}

function updateUI() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminBtn = document.querySelector('.admin-btn');
    const writeBtn = document.querySelector('.write-btn');
    const favoritesBtn = document.getElementById('favoritesBtn');
    const editPostBtn = document.getElementById('editPostBtn');

    if (currentUser) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        if (adminBtn) adminBtn.style.display = 'inline-block';
        if (writeBtn) writeBtn.style.display = 'inline-block';
        if (favoritesBtn) favoritesBtn.style.display = 'inline-block';
        if (editPostBtn) checkPostOwnership();
    } else {
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        if (adminBtn) adminBtn.style.display = 'none';
        if (writeBtn) writeBtn.style.display = 'none';
        if (favoritesBtn) favoritesBtn.style.display = 'none';
        if (editPostBtn) editPostBtn.style.display = 'none';
    }
}

function setupAuthButtons() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutPopup = document.getElementById('logoutPopup');
    const confirmLogoutBtn = document.getElementById('confirmLogout');
    const cancelLogoutBtn = document.getElementById('cancelLogout');

    if (loginBtn) loginBtn.addEventListener('click', login);
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        logoutPopup.style.display = 'block';
    });
    if (confirmLogoutBtn) confirmLogoutBtn.addEventListener('click', logout);
    if (cancelLogoutBtn) cancelLogoutBtn.addEventListener('click', () => {
        logoutPopup.style.display = 'none';
    });
}

function login() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            console.log('User logged in:', result.user.displayName);
            window.location.href = '/bloggywave.html';
        })
        .catch((error) => {
            console.error('Login error:', error.code, error.message);
            alert(`Login failed: ${error.message}. Please try again.`);
        });
}

function logout() {
    firebase.auth().signOut()
        .then(() => {
            console.log('User signed out');
            document.getElementById('logoutPopup').style.display = 'none';
            favorites = []; // Clear favorites on logout
            updateFavoritesUI();
            updateAllPostHeartIcons();
            window.location.href = '/index.html';
        })
        .catch((error) => {
            console.error('Error during logout:', error);
            alert('Logout failed. Please try again.');
        });
}
function loadPosts() {
    console.log("Loading posts");
    const postContainer = document.getElementById("posts");
    if (postContainer) {
        db.collection("posts").orderBy("created_at", "desc").get().then((querySnapshot) => {
            posts = [];
            querySnapshot.forEach((doc) => {
                posts.push({ id: doc.id, ...doc.data() });
            });
            console.log("Posts loaded:", posts);
            renderPosts(postContainer);
            updateFavoritesUI();  // Call this after posts are loaded
            updateAllPostHeartIcons();
        }).catch((error) => {
            console.error("Error loading posts: ", error);
        });
    }
}
function incrementViewCount(postId) {
    const postRef = db.collection("posts").doc(postId);

    return db.runTransaction((transaction) => {
        return transaction.get(postRef).then((postDoc) => {
            if (!postDoc.exists) {
                throw "Document does not exist!";
            }
            const newViews = (postDoc.data().views || 0) + 1;
            transaction.update(postRef, { views: newViews });
            return newViews;
        });
    }).then((newViews) => {
        console.log("Views updated to ", newViews);
        const viewCountElement = document.getElementById('view-count');
        if (viewCountElement) {
            viewCountElement.innerHTML = `<i class="bx bx-show"></i> ${newViews}`;
        }
    }).catch((error) => {
        console.error("Error updating view count: ", error);
    });
}
function displayViewCount(views) {
    const viewCountElement = document.createElement('p');
    viewCountElement.id = 'view-count';
    viewCountElement.className = 'post-meta-item';
    viewCountElement.innerHTML = `<i class="bx bx-show"></i> ${views} ${views === 1 ? 'view' : 'views'}`;

    const postMetaSection = document.querySelector('.post-meta');
    if (postMetaSection) {
        const existingViewCount = document.getElementById('view-count');
        if (existingViewCount) {
            existingViewCount.innerHTML = viewCountElement.innerHTML;
        } else {
            postMetaSection.appendChild(viewCountElement);
        }
    } else {
        console.error("Could not find .post-meta section to append view count");
    }
}
// function resetViewCounts() {
//     const postsRef = db.collection("posts");

//     postsRef.get().then((querySnapshot) => {
//         const batch = db.batch();

//         querySnapshot.forEach((doc) => {
//             batch.update(doc.ref, { views: 0 });
//         });

//         return batch.commit();
//     }).then(() => {
//         console.log("All view counts have been reset to 0");
//     }).catch((error) => {
//         console.error("Error resetting view counts: ", error);
//     });
// }
// resetViewCounts()

function setupFavorites() {
    console.log("Setting up favorites");
    const favoritesBtn = document.getElementById('favoritesBtn');
    const favoritesSection = document.getElementById('favoritesSection');
    const closeFavoritesBtn = document.getElementById('closeFavorites');

    if (favoritesBtn) {
        favoritesBtn.addEventListener('click', toggleFavorites);
    }
    if (closeFavoritesBtn) {
        closeFavoritesBtn.addEventListener('click', toggleFavorites);
    }

    if (currentUser) {
        console.log("Current user exists, fetching favorites");
        db.collection("users").doc(currentUser.uid).get().then((doc) => {
            if (doc.exists && doc.data().favorites) {
                favorites = doc.data().favorites;
                console.log("Favorites loaded:", favorites);
            } else {
                favorites = [];
                console.log("No favorites found, initializing empty array");
                db.collection("users").doc(currentUser.uid).set({ favorites: [] }, { merge: true });
            }
            updateFavoritesUI();
            updateAllPostHeartIcons();
        }).catch((error) => {
            console.error("Error loading favorites: ", error);
        });
    } else {
        console.log("No current user, favorites will be empty");
        favorites = [];
        updateFavoritesUI();
        updateAllPostHeartIcons();
    }
}


function toggleFavorites() {
    const favoritesSection = document.getElementById('favoritesSection');
    favoritesSection.classList.toggle('active');
}

function updateFavoritesUI() {
    console.log("Updating favorites UI");
    const favoritesList = document.getElementById('favoritesList');
    if (!favoritesList) {
        console.error("Favorites list element not found");
        return;
    }

    if (favorites.length > 0) {
        console.log("Rendering favorites:", favorites);
        favoritesList.innerHTML = favorites.map(postId => {
            const post = posts.find(p => p.id === postId);
            if (!post) {
                console.log("Post not found for ID:", postId);
                return ''; // Skip posts that aren't found
            }

            // Check if the post contains a video
            let mediaContent = '';
            if (post.video) {
                mediaContent = `<img src="images/video.webp" alt="${post.title}" style="width: 100px; height: auto;">`;
            } else {
                mediaContent = `<img src="${post.image || 'images/no-image-available.jpg'}" alt="${post.title}" style="width: 100px; height: auto;">`;
            }

            return `
                <div class="favorite-item">
                    ${mediaContent}
                    <div class="favorite-item-content">
                        <h3>${post.title}</h3>
                        <p>${post.category}</p>
                    </div>
                    <button onclick="removeFromFavorites('${post.id}')" class="remove-favorite">
                        <i class="bx bxs-heart"></i>
                    </button>
                </div>
            `;
        }).join(''); // Join the mapped items into a single string
    } else {
        console.log("No favorites to display");
        favoritesList.innerHTML = '<p>No favorites added yet.</p>';
    }
}



function addToFavorites(postId) {
    console.log("Adding to favorites:", postId);
    if (currentUser && !favorites.includes(postId)) {
        favorites.push(postId);
        updateFavoritesInFirestore()
            .then(() => {
                console.log("Favorite added successfully");
                updateFavoritesUI();
                updatePostHeartIcon(postId, true);
                // Increment the likes count in Firestore
                return db.collection("posts").doc(postId).update({
                    likesCount: firebase.firestore.FieldValue.increment(1)
                });
            })
            .then(() => {
                console.log("Likes count incremented");
                // Immediately update the UI after the likes are incremented
                const postElement = document.querySelector(`.post[data-id="${postId}"] .post-likes`);
                if (postElement) {
                    let currentLikes = parseInt(postElement.textContent.match(/\d+/)[0]);
                    postElement.innerHTML = `<i class="bx bxs-heart"></i> ${++currentLikes} likes`;
                }
                if (currentPostId === postId) {
                    updateLikesCountDisplay();
                }
            })
            .catch((error) => {
                console.error("Error adding to favorites: ", error);
                favorites = favorites.filter(id => id !== postId); // Rollback favorites if failed
            });
    }
}

function removeFromFavorites(postId) {
    console.log("Removing from favorites:", postId);
    if (currentUser) {
        const index = favorites.indexOf(postId);
        if (index > -1) {
            favorites.splice(index, 1);  // Remove post ID from favorites array

            // Update the user's favorites in Firestore
            updateFavoritesInFirestore()
                .then(() => {
                    console.log("Favorite removed successfully");
                    updateFavoritesUI();  // Update the UI to reflect changes
                    updatePostHeartIcon(postId, false);  // Update heart icon to unliked

                    // Decrement the likes count in Firestore
                    return db.collection("posts").doc(postId).update({
                        likesCount: firebase.firestore.FieldValue.increment(-1)
                    });
                })
                .then(() => {
                    console.log("Likes count decremented");
                    // Update UI to show decreased likes
                    const postElement = document.querySelector(`.post[data-id="${postId}"] .post-likes`);
                    if (postElement) {
                        let currentLikes = parseInt(postElement.textContent.match(/\d+/)[0]);
                        postElement.innerHTML = `<i class="bx bxs-heart"></i> ${--currentLikes} likes`;
                    }
                    // If viewing the post's details, also update the likes display there
                    if (currentPostId === postId) {
                        updateLikesCountDisplay();
                    }
                })
                .catch((error) => {
                    console.error("Error removing from favorites or updating likes:", error);
                    favorites.push(postId);  // Rollback if the operation fails
                });
        }
    }
}


function updateLikesCountDisplay() {
    const likesCountElement = document.getElementById('likes-count');
    if (likesCountElement) {
        db.collection("posts").doc(currentPostId).get().then((doc) => {
            if (doc.exists) {
                const likesCount = doc.data().likesCount || 0;
                likesCountElement.textContent = `${likesCount} ${likesCount === 1 ? 'like' : 'likes'}`;
            }
        }).catch((error) => {
            console.error("Error getting likes count: ", error);
        });
    }
}

function updateFavoritesInFirestore() {
    console.log("Updating favorites in Firestore:", favorites);
    if (currentUser) {
        return db.collection("users").doc(currentUser.uid).set({
            favorites: favorites
        }, { merge: true }).then(() => {
            console.log("Favorites updated in Firestore successfully");
        }).catch(error => {
            console.error("Error updating favorites in Firestore: ", error);
            return Promise.reject(error);
        });
    }
    console.log("No current user, skipping Firestore update");
    return Promise.resolve();
}
function updatePostHeartIcon(postId, isFavorite) {
    const heartIcon = document.querySelector(`.post[data-id="${postId}"] .favorite-icon`);
    if (heartIcon) {
        heartIcon.classList.toggle('active', isFavorite);
        heartIcon.innerHTML = isFavorite ? '<i class="bx bxs-heart"></i>' : '<i class="bx bxs-heart"></i>';
    }
}

function updateAllPostHeartIcons() {
    const heartIcons = document.querySelectorAll('.favorite-icon');
    heartIcons.forEach(icon => {
        const postId = icon.closest('.post').dataset.id;
        const isFavorite = favorites.includes(postId);
        icon.classList.toggle('active', isFavorite);
        icon.style.display = currentUser ? 'inline-block' : 'none';
    });
}


// Update renderPosts function to include reading time
function renderPosts(container) {
    const path = window.location.pathname;

    container.innerHTML = posts
        .map((post) => {
            let mediaContent = '';

            // Check if the post contains a video and we are on bloggywave.html
            if (post.video && path.includes('bloggywave.html')) {
                // Video with the same dimensions as the image
                mediaContent = `
                    <video src="${post.video}" controls muted loop playsinline class="post-img"></video>
                `;
            } else {
                // Image with fixed height and width
                mediaContent = `
                    <img class="post-img" src="${post.image || 'images/no-image-available.jpg'}" 
                         alt="${post.title}">
                `;
            }

            return `
                <div class="post" data-category="${post.category}" data-id="${post.id}">
                    ${mediaContent}
                    <h3 class="post-category">${post.category}</h3>
                    <a href="post-details.html?id=${post.id}">
                        <h2 class="post-title">${post.title}</h2>
                    </a>
                    <div class="post-author">
                        <img src="${post.authorImage || '/api/placeholder/30/30'}" alt="${post.authorName}" class="author-image">
                        <a href="user-profile.html?id=${post.authorId}" class="author-name">By: ${post.authorName || 'Anonymous'}</a>
                    </div>
                    <p class="post-time">${formatDate(post.created_at)}</p>
                    <p class="post-read-time"><i class="bx bx-time"></i> ${estimateReadingTime(post.content)}</p>
                    <p class="post-likes"><i class="bx bxs-heart"></i> ${post.likesCount || 0} likes</p>
                    <div class="post-desc">${post.content.replace(/<[^>]*>/g, '').substring(0, 100)}...</div>
                    <a href="post-details.html?id=${post.id}" class="read-more">Read more</a>
                    <button onclick="toggleFavorite('${post.id}')" class="favorite-icon ${favorites.includes(post.id) ? 'active' : ''}" style="display: ${currentUser ? 'inline-block' : 'none'}">
                        <i class="bx ${favorites.includes(post.id) ? 'bxs-heart' : 'bx-heart'}"></i>
                    </button>
                </div>
            `;
        })
        .join("");
}



function loadUserProfile() {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');

    if (!userId) {
        console.log("No user ID provided");
        document.getElementById('user-profile').innerHTML = '<p>Error: No user ID provided</p>';
        return;
    }

    db.collection("users").doc(userId).get().then((doc) => {
        if (doc.exists) {
            const user = doc.data();
            displayUserProfile(user, userId);
            loadUserPosts(userId);
        } else {
            console.log("No such user!");
            document.getElementById('user-profile').innerHTML = '<p>User not found</p>';
        }
    }).catch((error) => {
        console.error("Error getting user:", error);
        document.getElementById('user-profile').innerHTML = '<p>Error loading user profile</p>';
    });
}

function displayUserProfile(user, userId) {
    const profileContainer = document.getElementById('user-profile');
    profileContainer.innerHTML = `
        <div class="profile-header" style="display: flex; flex-direction: column;">
            <img src="${user.photoURL || 'images/user.jpg'}" alt="${user.displayName}" class="profile-image" id="userImage">
            <h1 id="username">${user.displayName || 'User'}</h1>
        </div>
        <div class="profile-stats">
            <div class="stat">
                <span class="stat-value" id="post-count">0</span>
                <span class="stat-label">Posts</span>
            </div>
            <div class="stat">
                <span class="stat-value" id="total-likes">0</span>
                <span class="stat-label">Total Likes</span>
            </div>
        </div>
        <div class="profile-posts">
            <h2>Posts by User</h2>
            <div id="user-posts" class="posts-grid"></div>
        </div>
    `;
}

// Display User Posts on Profile (Reusing renderPosts)
function loadUserPosts(userId) {
    db.collection("posts").where("authorId", "==", userId).get().then((querySnapshot) => {
        let postCount = 0;
        let totalLikes = 0;
        const userPosts = [];

        querySnapshot.forEach((doc) => {
            const post = doc.data();
            post.id = doc.id;
            userPosts.push(post);
            postCount++;
            totalLikes += post.likesCount || 0;
        });

        document.getElementById('post-count').textContent = postCount;
        document.getElementById('total-likes').textContent = totalLikes;

        const userPostsContainer = document.getElementById('user-posts');
        userPostsContainer.innerHTML = userPosts.map(post => {
            let mediaContent = '';

            // Check if the post contains a video and display it
            if (post.video) {
                mediaContent = `
                    <video src="${post.video}" controls muted loop playsinline class="post-img"></video>
                `;
            } else {
                // Image with fallback if no video
                mediaContent = `
                    <img class="post-img" src="${post.image || 'images/no-image-available.jpg'}" alt="${post.title}">
                `;
            }

            return `
                <div class="post" data-category="${post.category}" data-id="${post.id}">
                    ${mediaContent}
                    <h3 class="post-category">${post.category}</h3>
                    <a href="post-details.html?id=${post.id}">
                        <h2 class="post-title">${post.title}</h2>
                    </a>
                    <div class="post-author" style="display: flex; flex-direction: row;">
                        <img src="${post.authorImage || '/api/placeholder/30/30'}" alt="${post.authorName}" class="author-image">
                        <p class="author-name" style="margin-top: 10px;">By: ${post.authorName || 'Anonymous'}</p>
                    </div>
                    <p class="post-time">${formatDate(post.created_at)}</p>
                    <p class="post-read-time"><i class="bx bx-time"></i> ${estimateReadingTime(post.content)}</p>
                    <p class="post-likes"><i class="bx bxs-heart"></i> ${post.likesCount || 0} likes</p>
                    <div class="post-desc">${post.content.replace(/<[^>]*>/g, '').substring(0, 100)}...</div>
                    <a href="post-details.html?id=${post.id}" class="read-more">Read more</a>
                    <button onclick="toggleFavorite('${post.id}')" class="favorite-icon ${favorites.includes(post.id) ? 'active' : ''}" style="display: ${currentUser ? 'inline-block' : 'none'}">
                        <i class="bx ${favorites.includes(post.id) ? 'bxs-heart' : 'bx-heart'}"></i>
                    </button>
                </div>
            `;
        }).join('');
    }).catch((error) => {
        console.error("Error getting user posts:", error);
        document.getElementById('user-posts').innerHTML = '<p>Error loading user posts</p>';
    });
}


function toggleFavorite(postId) {
    if (currentUser) {
        if (favorites.includes(postId)) {
            removeFromFavorites(postId);
        } else {
            addToFavorites(postId);
        }
    } else {
        alert('Please log in to manage favorites.');
    }
}

function formatDate(timestamp) {
    if (timestamp && timestamp.toDate) {
        timestamp = timestamp.toDate();
    }
    if (!(timestamp instanceof Date)) {
        return 'Date unavailable';
    }
    return timestamp.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function setupFilterListeners() {
    const filterItems = document.querySelectorAll('.filter-item');

    filterItems.forEach(item => {
        item.addEventListener('click', function () {
            filterItems.forEach(i => i.classList.remove('active-filter'));
            this.classList.add('active-filter');
            const selectedFilter = this.getAttribute('data-filter');
            filterPosts(selectedFilter);
        });
    });
}

function filterPosts(category) {
    const postElements = document.querySelectorAll('.post');
    postElements.forEach(post => {
        const postCategory = post.getAttribute('data-category');
        if (category === 'all' || postCategory === category) {
            post.style.display = 'block';
        } else {
            post.style.display = 'none';
        }
    });
}
function setupHeaderScroll() {
    let header = document.querySelector("header");
    if (header) {
        window.addEventListener("scroll", () => {
            header.classList.toggle("shadow", window.scrollY > 0);
        });
    }
}
function setupSearchFunctionality() {
    const searchBox = document.querySelector('.search-box input');
    if (searchBox) {
        searchBox.addEventListener('input', function () {
            const searchTerm = this.value.toLowerCase().trim();

            // Check if searching by author name
            const isAuthorSearch = posts.some(post => post.authorName.toLowerCase() === searchTerm);

            if (isAuthorSearch) {
                // Call the function to search posts by the author's name
                searchByAuthorName(searchTerm);
            } else {
                // Search by title only
                const postElements = document.querySelectorAll('.post');
                postElements.forEach(post => {
                    const title = post.querySelector('.post-title').textContent.toLowerCase();

                    // Only display posts where the title matches the search term
                    if (title.includes(searchTerm)) {
                        post.style.display = 'block';
                    } else {
                        post.style.display = 'none';
                    }
                });
            }
        });
    }
}

function searchByAuthorName(authorName) {
    db.collection("posts")
        .where("authorName", "==", authorName)
        .get()
        .then((querySnapshot) => {
            const postContainer = document.getElementById("posts");
            posts = []; // Clear the posts array
            querySnapshot.forEach((doc) => {
                posts.push({ id: doc.id, ...doc.data() });
            });
            console.log("Posts by author loaded:", posts);
            renderPosts(postContainer); // Reuse your existing renderPosts function to display results
            updateFavoritesUI(); // Ensure favorites are updated in UI
            updateAllPostHeartIcons(); // Update heart icons if applicable
        })
        .catch((error) => {
            console.error("Error searching posts by author: ", error);
        });
}


// Update loadPostDetails function to display reading time
function loadPostDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id'); // Extract post ID from the URL

    if (!postId) {
        console.error("Error: Post ID not found in the URL.");
        alert("Error: Unable to load post. Please try again.");
        return;
    }

    currentPostId = postId; // Set the global currentPostId

    // Fetch and display post details
    db.collection("posts").doc(postId).get().then((doc) => {
        if (doc.exists) {
            const post = doc.data();
            // Populate the post details in the UI
            document.getElementById('post-title').textContent = post.title;
            document.getElementById('post-content').innerHTML = post.content;
            document.getElementById('post-category').textContent = post.category;

            const postImage = document.getElementById('post-image');
            const postVideo = document.getElementById('post-video');

            // Check if there's an image or video and display it accordingly
            if (post.image) {
                postImage.src = post.image;
                postImage.style.display = 'block';
                postVideo.style.display = 'none';
            } else if (post.video) {
                postVideo.src = post.video;
                postVideo.style.display = 'block';
                postImage.style.display = 'none';
            }

            // Set up post metadata
            const metaElement = document.createElement('div');
            metaElement.className = 'post-meta';
            metaElement.innerHTML = `
                <p class="post-meta-item"><i class="bx bx-user"></i> By: ${post.authorName || 'Anonymous'}</p>
                <p class="post-meta-item"><i class="bx bx-calendar"></i> Posted on: ${formatDate(post.created_at)}</p>
                <p class="post-meta-item"><i class="bx bx-time"></i> ${estimateReadingTime(post.content)}</p>
                <p class="post-meta-item">
                    <span id="view-count"><i class="bx bx-show"></i> ${post.views || 0}</span>  
                    <span class="separator">|</span>
                    <span id="likes-count"><i class="bx bxs-heart"></i> ${post.likesCount || 0}</span>
                </p>
            `;
            document.querySelector('.header-content').appendChild(metaElement);

            // Increment the view count
            incrementViewCount(postId);
            setupShareFunctionality(post.title);
            checkPostOwnership();
            updateLikesCountDisplay();
        } else {
            console.error("Error: Post not found.");
            alert("Error: Post not found.");
        }
    }).catch((error) => {
        console.error("Error loading post details: ", error);
    });

    // Setup the comment section after loading post details
    setupCommentSection();
}


// Estimate reading time function
function estimateReadingTime(text) {
    // Remove HTML tags
    const plainText = text.replace(/<[^>]*>/g, '');

    // Count words
    const wordCount = plainText.split(/\s+/).filter(word => word.length > 0).length;

    // Estimate reading time
    const wordsPerMinute = 200; // Average reading speed
    const minutes = Math.ceil(wordCount / wordsPerMinute);

    // Format the output
    if (minutes < 1) {
        return 'Less than a minute read';
    } else if (minutes === 1) {
        return '1 minute read';
    } else {
        return `${minutes} minute read`;
    }
}
// Example usage:
function displayReadingTime() {
    const postContent = document.getElementById('post-content').innerHTML;
    const readingTime = estimateReadingTime(postContent);

    const readingTimeElement = document.createElement('p');
    readingTimeElement.id = 'reading-time';
    readingTimeElement.className = 'post-meta-item';
    readingTimeElement.innerHTML = `<i class="bx bx-time"></i> ${readingTime}`;

    const postMetaSection = document.querySelector('.post-meta');
    if (postMetaSection) {
        postMetaSection.appendChild(readingTimeElement);
    } else {
        console.error("Could not find .post-meta section to append reading time");
    }
}


function setupAddPostForm() {
    const form = document.querySelector('#add-post-form');
    const quill = new Quill('#editor-container', { theme: 'snow' });

    let uploadInProgress = false; // Track upload status

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        if (!currentUser) {
            alert('You must be logged in to add a post.');
            return;
        }

        const title = document.getElementById('title').value;
        const category = document.getElementById('category').value;
        const content = quill.root.innerHTML;
        const mediaInput = document.getElementById('media');
        const mediaFile = mediaInput.files[0];

        if (!mediaFile) {
            alert("Please select an image or video to upload.");
            return;
        }

        // Determine if the file is an image or a video
        const mediaType = mediaFile.type.startsWith('image/') ? 'image' : mediaFile.type.startsWith('video/') ? 'video' : null;

        if (!mediaType) {
            alert("Only image or video files are allowed.");
            return;
        }

        // Show alert if the media is a video
        if (mediaType === 'video') {
            alert("Uploading video might take up to 0.5-2 minutes, please don't leave the page.");
        }

        // Prevent navigation when upload starts
        uploadInProgress = true;
        window.onbeforeunload = function () {
            return "An upload is in progress. Are you sure you want to leave?";
        };

        const storageRef = firebase.storage().ref(`posts/${currentUser.uid}/${mediaFile.name}`);
        const uploadTask = storageRef.put(mediaFile);

        // Store upload status in localStorage
        localStorage.setItem('uploading', true);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload is ' + progress + '% done');
                localStorage.setItem('uploadProgress', progress); // Save progress in localStorage
            },
            (error) => {
                console.error(`${mediaType} upload failed:`, error);
                localStorage.removeItem('uploading'); // Clear localStorage if upload fails
                uploadInProgress = false;
                window.onbeforeunload = null; // Allow navigation again
            },
            () => {
                uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                    console.log(`${mediaType} available at`, downloadURL);

                    const newPost = {
                        title,
                        category,
                        content,
                        [mediaType]: downloadURL,
                        created_at: firebase.firestore.FieldValue.serverTimestamp(),
                        authorId: currentUser.uid,
                        authorName: currentUser.displayName || currentUser.email,
                        authorImage: currentUser.photoURL || null
                    };

                    // Add the new post to Firestore
                    db.collection("posts").add(newPost)
                        .then(() => {
                            localStorage.removeItem('uploading'); // Clear upload flag
                            alert('Post added successfully!');
                            uploadInProgress = false;
                            window.onbeforeunload = null; // Allow navigation after success
                            window.location.href = 'bloggywave.html'; // Redirect after success
                        })
                        .catch((error) => {
                            console.error("Error adding post: ", error);
                            alert('Failed to add post. Please try again.');
                            uploadInProgress = false;
                            window.onbeforeunload = null; // Allow navigation after failure
                        });
                });
            }
        );
    });

    // Handle when user leaves while upload is in progress
    window.addEventListener('beforeunload', function (e) {
        if (uploadInProgress) {
            e.preventDefault();
            e.returnValue = ''; // This is required for modern browsers
        }
    });
}



function loadAdminPage() {
    console.log("loadAdminPage called");
    console.log("Current user:", currentUser);

    if (!currentUser) {
        console.log("No current user, redirecting to index.html");
        window.location.href = 'index.html';
        return;
    }

    const tableBody = document.querySelector('#post-table tbody');
    db.collection("posts").where("authorId", "==", currentUser.uid).get()
        .then((querySnapshot) => {
            if (querySnapshot.empty) {
                tableBody.innerHTML = '<tr><td colspan="5">No posts found</td></tr>';
            } else {
                tableBody.innerHTML = querySnapshot.docs.map(doc => {
                    const post = doc.data();

                    // Check if the post has a video, display .webp image if so
                    let mediaContent = '';
                    if (post.video) {
                        mediaContent = `<img src="images/video.webp" alt="${post.title}" style="width: 100px; height: auto; color: white;">`;
                    } else {
                        mediaContent = `<img src="${post.image || '/api/placeholder/100/100'}" alt="${post.title}" style="width: 100px; height: auto;">`;
                    }

                    return `
                        <tr>
                            <td>${mediaContent}</td>
                            <td>${post.title}</td>
                            <td>${post.category}</td>
                            <td>
                                <button onclick="deletePost('${doc.id}')" class="btn btn-danger delete-button">Delete</button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        })
        .catch((error) => {
            console.error("Error loading user posts: ", error);
            tableBody.innerHTML = '<tr><td colspan="5">Error loading posts: ' + error.message + '</td></tr>';
        });

    updateAccountInfo();
    setupAccountListeners();
}


function updateAccountInfo() {
    const userImage = document.getElementById('userImage');
    const username = document.getElementById('username');
    const email = document.getElementById('email');

    if (currentUser.photoURL) {
        userImage.src = currentUser.photoURL;
    }

    username.textContent = currentUser.displayName || 'Not set';

    email.textContent = 'Click to reveal';
    email.addEventListener('click', function () {
        this.textContent = currentUser.email;
    });
}

function setupAccountListeners() {
    const changeImageBtn = document.getElementById('changeImageBtn');
    const imageUpload = document.getElementById('imageUpload');
    const changeUsernameBtn = document.getElementById('changeUsernameBtn');
    const changeUsernamePopup = document.getElementById('changeUsernamePopup');
    const newUsernameInput = document.getElementById('newUsername');
    const usernameAvailability = document.getElementById('usernameAvailability');
    const confirmUsernameChange = document.getElementById('confirmUsernameChange');
    const cancelUsernameChange = document.getElementById('cancelUsernameChange');

    if (changeImageBtn && imageUpload) {
        changeImageBtn.addEventListener('click', () => imageUpload.click());
        imageUpload.addEventListener('change', handleImageUpload);
    }



    if (changeUsernameBtn && changeUsernamePopup) {
        changeUsernameBtn.addEventListener('click', () => {
            changeUsernamePopup.style.display = 'flex';
        });
    }

    if (cancelUsernameChange) {
        cancelUsernameChange.addEventListener('click', () => {
            changeUsernamePopup.style.display = 'none';
        });
    }

    if (newUsernameInput) {
        newUsernameInput.addEventListener('input', debounce(checkUsernameAvailability, 300));
    }

    if (confirmUsernameChange) {
        confirmUsernameChange.addEventListener('click', changeUsername);
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const storageRef = firebase.storage().ref(`users/${currentUser.uid}/profile-image`);

        // Get the current user's old profile image URL
        const oldImageURL = currentUser.photoURL;

        const uploadTask = storageRef.put(file);
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload is ' + progress + '% done');
            },
            (error) => {
                console.error("Error uploading image: ", error);
                alert('Failed to upload image. Please try again.');
            },
            () => {
                // Get the new image URL after upload completes
                uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                    // Update the user's profile with the new image
                    currentUser.updateProfile({ photoURL: downloadURL })
                        .then(() => {
                            console.log('Profile image updated successfully');
                            document.getElementById('userImage').src = currentUser.photoURL;
                            alert('Profile image updated successfully!');

                            // Delete the old profile image if it exists
                            if (oldImageURL) {
                                const oldImageRef = firebase.storage().refFromURL(oldImageURL);
                                oldImageRef.delete()
                                    .then(() => {
                                        console.log("Old profile image deleted successfully");
                                    })
                                    .catch((error) => {
                                        console.error("Error deleting old profile image:", error);
                                    });
                            }

                            // Update all posts by this user with the new profile image
                            return db.collection("posts").where("authorId", "==", currentUser.uid).get();
                        })
                        .then((querySnapshot) => {
                            const batch = db.batch();
                            querySnapshot.forEach((doc) => {
                                batch.update(doc.ref, { authorImage: currentUser.photoURL });
                            });
                            return batch.commit();
                        })
                        .then(() => {
                            console.log("All posts updated with new profile image");
                        })
                        .catch((error) => {
                            console.error("Error updating profile image or posts:", error);
                        });
                });
            }
        );
    }
}


// Check username availability
function checkUsernameAvailability() {
    const newUsername = document.getElementById('newUsername').value.trim();
    const usernameAvailability = document.getElementById('usernameAvailability');
    const confirmUsernameChange = document.getElementById('confirmUsernameChange');

    // Reset the availability message and button state
    usernameAvailability.textContent = 'Checking availability...';
    confirmUsernameChange.disabled = true;

    if (newUsername.length < 3) {
        usernameAvailability.textContent = 'Username must be at least 3 characters long';
        return;
    }

    // Check if the new username is the same as the current username
    if (newUsername === currentUser.displayName) {
        usernameAvailability.textContent = 'This is your current username';
        return;
    }

    console.log("Checking availability for username:", newUsername);

    db.collection('usernames').doc(newUsername).get()
        .then((doc) => {
            if (doc.exists) {
                console.log("Username is already taken");
                usernameAvailability.textContent = 'Username is not available';
            } else {
                console.log("Username is available");
                usernameAvailability.textContent = 'Username is available';
                confirmUsernameChange.disabled = false;
            }
        })
        .catch((error) => {
            console.error("Error checking username:", error);
            usernameAvailability.textContent = 'Error checking username availability';
            console.error("Error code:", error.code);
            console.error("Error message:", error.message);
        });
}

// Change username function
function changeUsername() {
    const newUsername = document.getElementById('newUsername').value.trim();
    const usernameAvailability = document.getElementById('usernameAvailability');
    const changeUsernamePopup = document.getElementById('changeUsernamePopup');

    if (usernameAvailability.textContent !== 'Username is available') {
        alert('Please choose an available username');
        return;
    }

    console.log("Starting the username change process for:", newUsername);

    // Start a Firestore batch to ensure changes are done atomically
    const batch = db.batch();
    const newUsernameRef = db.collection('usernames').doc(newUsername);
    const currentUsernameRef = currentUser.displayName ? db.collection('usernames').doc(currentUser.displayName) : null;

    // Set the new username document
    batch.set(newUsernameRef, { uid: currentUser.uid });

    // Delete the old username if it exists
    if (currentUsernameRef) {
        batch.delete(currentUsernameRef);
    }

    batch.commit()
        .then(() => {
            console.log("Batch committed successfully");
            // Update the user's profile in Firebase Auth
            return currentUser.updateProfile({ displayName: newUsername });
        })
        .then(() => {
            // Update the UI to reflect the new username
            console.log("Profile updated successfully in Firebase Auth");
            document.getElementById('username').textContent = newUsername;
            changeUsernamePopup.style.display = 'none';

            // Update all posts with the new username
            return db.collection("posts").where("authorId", "==", currentUser.uid).get();
        })
        .then((querySnapshot) => {
            const postUpdateBatch = db.batch();
            querySnapshot.forEach((doc) => {
                postUpdateBatch.update(doc.ref, { authorName: newUsername });
            });
            return postUpdateBatch.commit();
        })
        .then(() => {
            console.log("Username successfully updated in posts");
            alert('Username updated successfully!');
            window.location.reload(); // Reload to reflect changes
        })
        .catch((error) => {
            console.error("Error updating username:", error);
            alert('Failed to update username. Please try again.');
        });
}



function deletePost(id) {
    if (!currentUser) {
        alert('You must be logged in to delete a post.');
        return;
    }
    // Fetch the post data to access the media URL
    db.collection("posts").doc(id).get().then((doc) => {
        if (doc.exists && doc.data().authorId === currentUser.uid) {
            const postData = doc.data();
            let deletePromises = [];

            // Delete associated media from Firebase Storage
            if (postData.image) {
                const imageRef = firebase.storage().refFromURL(postData.image);
                deletePromises.push(imageRef.delete());
            } else if (postData.video) {
                const videoRef = firebase.storage().refFromURL(postData.video);
                deletePromises.push(videoRef.delete());
            }

            // Delete the post from Firestore
            deletePromises.push(db.collection("posts").doc(id).delete());

            // Wait for all deletions to complete
            Promise.all(deletePromises).then(() => {
                console.log("Post and associated media deleted successfully");
                loadAdminPage(); // Refresh the admin page
            }).catch((error) => {
                console.error("Error deleting post or media: ", error);
                alert('Failed to delete post. Please try again.');
            });
        } else {
            alert('You can only delete your own posts.');
        }
    }).catch((error) => {
        console.error("Error checking post ownership: ", error);
    });
}


function setupShareFunctionality(postTitle) {
    const shareButtons = document.querySelectorAll('.social a');
    shareButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const platform = button.getAttribute('data-platform');
            sharePost(platform, postTitle);
        });
    });
}
function sharePost(platform) {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.getElementById('post-title').textContent);
    let shareUrl;

    switch (platform) {
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
            break;
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
            break;
        case 'linkedin':
            shareUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${url}&title=${title}`;
            break;

        case 'link':
            showSharePopup(window.location.href);
            return;
    }

    if (shareUrl) {
        window.open(shareUrl, '_blank');
    }
}


function showSharePopup(url) {
    const sharePopup = document.getElementById('share-popup');
    const shareLinkInput = document.getElementById('share-link');
    const copyLinkBtn = document.getElementById('copy-link');
    const closePopupBtn = document.getElementById('close-popup');

    if (sharePopup && shareLinkInput) {
        sharePopup.style.display = 'flex';
        shareLinkInput.value = url;

        copyLinkBtn.addEventListener('click', function () {
            shareLinkInput.select();
            document.execCommand('copy');
            copyLinkBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyLinkBtn.textContent = 'Copy Link';
            }, 2000);
        });

        closePopupBtn.addEventListener('click', function () {
            sharePopup.style.display = 'none';
        });

        sharePopup.addEventListener('click', function (e) {
            if (e.target === sharePopup) {
                sharePopup.style.display = 'none';
            }
        });
    }
}

function checkPostOwnership() {
    const editPostBtn = document.getElementById('editPostBtn');
    if (currentUser && currentPostId) {
        db.collection("posts").doc(currentPostId).get().then((doc) => {
            if (doc.exists && doc.data().authorId === currentUser.uid) {
                editPostBtn.style.display = 'inline-block';
                editPostBtn.addEventListener('click', showEditPostPopup);
            } else {
                editPostBtn.style.display = 'none';
            }
        }).catch((error) => {
            console.error("Error checking post ownership: ", error);
        });
    } else {
        editPostBtn.style.display = 'none';
    }
}

function showEditPostPopup() {
    const editPostPopup = document.getElementById('editPostPopup');
    if (!editPostPopup) {
        console.error("Edit post popup not found");
        return;
    }
    editPostPopup.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    if (!quill) {
        quill = new Quill('#edit-content-container', {
            theme: 'snow',
        });
    }

    db.collection("posts").doc(currentPostId).get().then((doc) => {
        if (doc.exists) {
            const post = doc.data();
            document.getElementById('edit-title').value = post.title;
            document.getElementById('edit-category').value = post.category;
            quill.root.innerHTML = post.content;
        }
    }).catch((error) => {
        console.error("Error loading post data for editing: ", error);
    });
}

function hideEditPostPopup() {
    const editPostPopup = document.getElementById('editPostPopup');
    if (editPostPopup) {
        editPostPopup.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function setupEditPostForm() {
    const form = document.getElementById('edit-post-form');
    const cancelEditBtn = document.getElementById('cancelEdit');

    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            updatePost();
        });
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', hideEditPostPopup);
    }
}

function updatePost() {
    if (!currentUser) {
        alert('You must be logged in to edit a post.');
        return;
    }

    const title = document.getElementById('edit-title').value;
    const category = document.getElementById('edit-category').value;
    const content = quill.root.innerHTML;
    const mediaInput = document.getElementById('edit-image');
    const mediaFile = mediaInput.files[0];

    let uploadInProgress = false; // Track upload status

    const updatedPost = {
        title,
        category,
        content,
        updated_at: firebase.firestore.FieldValue.serverTimestamp(),
    };

    // Fetch the existing post to compare media
    db.collection("posts").doc(currentPostId).get().then((doc) => {
        if (!doc.exists) {
            throw new Error("Post does not exist");
        }

        const postData = doc.data();
        const oldImageUrl = postData.image;
        const oldVideoUrl = postData.video;
        let deleteOldMedia = false;

        if (mediaFile) {
            const mediaType = mediaFile.type.startsWith('image/') ? 'image' : mediaFile.type.startsWith('video/') ? 'video' : null;

            if (!mediaType) {
                alert('Only image or video files are allowed.');
                return;
            }

            // Check if the new media is different from the old one
            if ((mediaType === 'image' && oldImageUrl) || (mediaType === 'video' && oldVideoUrl)) {
                deleteOldMedia = true;
            }

            const storageRef = firebase.storage().ref(`posts/${currentUser.uid}/${mediaFile.name}`);
            const uploadTask = storageRef.put(mediaFile);

            // Prevent navigation when upload starts
            uploadInProgress = true;
            window.onbeforeunload = function () {
                return "Updating post is in progress do you still want to leave?";
            };

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log('Upload is ' + progress + '% done');
                },
                (error) => {
                    console.error(`${mediaType} upload failed:`, error);
                    uploadInProgress = false;
                    window.onbeforeunload = null; // Allow navigation after failure
                },
                () => {
                    uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                        if (mediaType === 'image') {
                            updatedPost.image = downloadURL;
                            updatedPost.video = null;  // Clear any existing video
                        } else if (mediaType === 'video') {
                            updatedPost.video = downloadURL;
                            updatedPost.image = null;  // Clear any existing image
                        }

                        // Delete old media if necessary
                        if (deleteOldMedia) {
                            const oldMediaUrl = mediaType === 'image' ? oldImageUrl : oldVideoUrl;
                            if (oldMediaUrl) {
                                const oldMediaRef = firebase.storage().refFromURL(oldMediaUrl);
                                oldMediaRef.delete()
                                    .then(() => {
                                        console.log("Old media deleted successfully");
                                    })
                                    .catch((error) => {
                                        console.error("Error deleting old media:", error);
                                    });
                            }
                        }

                        // Update the post in Firestore with the new media
                        db.collection("posts").doc(currentPostId).update(updatedPost)
                            .then(() => {
                                uploadInProgress = false;
                                window.onbeforeunload = null; // Allow navigation after success

                                // Update UI dynamically instead of refreshing
                                document.getElementById('post-title').textContent = updatedPost.title;
                                document.getElementById('post-category').textContent = updatedPost.category;
                                document.getElementById('post-content').innerHTML = updatedPost.content;

                                if (updatedPost.image) {
                                    document.getElementById('post-image').src = updatedPost.image;
                                    document.getElementById('post-video').style.display = 'none';
                                } else if (updatedPost.video) {
                                    document.getElementById('post-video').src = updatedPost.video;
                                    document.getElementById('post-image').style.display = 'none';
                                }

                                alert('Post updated successfully!');
                            })
                            .catch((error) => {
                                console.error("Error updating post: ", error);
                                alert('Failed to update post. Please try again.');
                                uploadInProgress = false;
                                window.onbeforeunload = null; // Allow navigation after failure
                            });
                    });
                }
            );
        } else {
            // No new media, just update text content
            db.collection("posts").doc(currentPostId).update(updatedPost)
                .then(() => {
                    // Dynamically update the UI without a reload
                    document.getElementById('post-title').textContent = updatedPost.title;
                    document.getElementById('post-category').textContent = updatedPost.category;
                    document.getElementById('post-content').innerHTML = updatedPost.content;

                    alert('Post updated successfully!');
                })
                .catch((error) => {
                    console.error("Error updating post: ", error);
                    alert('Failed to update post. Please try again.');
                });
        }
    }).catch((error) => {
        console.error("Error fetching post for updating:", error);
    });

    // Handle when user leaves while upload is in progress
    window.addEventListener('beforeunload', function (e) {
        if (uploadInProgress) {
            e.preventDefault();
            e.returnValue = ''; // Required for modern browsers
        }
    });
}



document.addEventListener('DOMContentLoaded', function () {
    const shareIcon = document.querySelector('.bx-link');
    const sharePopup = document.getElementById('share-popup');
    const shareLinkInput = document.getElementById('share-link');
    const copyLinkBtn = document.getElementById('copy-link');
    const closePopupBtn = document.getElementById('close-popup');

    if (shareIcon) {
        shareIcon.addEventListener('click', function (e) {
            e.preventDefault();
            sharePopup.style.display = 'flex';
            shareLinkInput.value = window.location.href;
        });
    }

    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', function () {
            shareLinkInput.select();
            document.execCommand('copy');
            copyLinkBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyLinkBtn.textContent = 'Copy Link';
            }, 2000);
        });
    }

    if (closePopupBtn) {
        closePopupBtn.addEventListener('click', function () {
            sharePopup.style.display = 'none';
        });
    }

    if (sharePopup) {
        sharePopup.addEventListener('click', function (e) {
            if (e.target === sharePopup) {
                sharePopup.style.display = 'none';
            }
        });
    }
});

function setupCommentSection() {
    const commentForm = document.getElementById('comment-form');
    if (commentForm) {
        commentForm.addEventListener('submit', handleCommentSubmission);
    }
    loadComments();
}

function handleCommentSubmission(e) {
    e.preventDefault();

    // Ensure a user is signed in
    if (!currentUser) {
        alert('You must be logged in to post a comment.');
        return;
    }

    const commentInput = document.getElementById('comment-input');
    const commentText = commentInput.value.trim();

    // Ensure comment text is not empty
    if (!commentText) {
        alert("Please enter a valid comment.");
        return;
    }

    // Ensure currentPostId is defined
    if (!currentPostId) {
        console.error("Error: Post ID is undefined.");
        alert("Error: Could not determine the post ID. Please try again.");
        return;
    }

    // Prepare the comment data
    const newComment = {
        text: commentText,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || 'Anonymous',
        authorImage: currentUser.photoURL || '/api/placeholder/30/30',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        likes: 0
    };

    // Add the comment to Firestore
    db.collection("posts").doc(currentPostId).collection("comments").add(newComment)
        .then(() => {
            console.log("Comment added successfully");
            commentInput.value = ''; // Clear the input field
            loadComments(); // Reload the comments after a new one is added
        })
        .catch((error) => {
            console.error("Error adding comment: ", error);
            alert('Failed to post comment. Please try again.');
        });
}


function loadComments() {
    const commentsList = document.getElementById('comments-list');
    const postId = currentPostId; // Ensure currentPostId is defined
    if (!postId) {
        console.error("Post ID is undefined");
        return;
    }

    if (!commentsList) {
        console.error("Comments list element not found");
        return;
    }

    db.collection("posts").doc(postId).collection("comments")
        .orderBy("createdAt", "desc")
        .get()
        .then((querySnapshot) => {
            commentsList.innerHTML = ''; // Clear previous comments
            querySnapshot.forEach((doc) => {
                const comment = { id: doc.id, ...doc.data() };
                const commentElement = createCommentElement(comment);
                commentsList.appendChild(commentElement); // Add each comment to the list
            });
        })
        .catch((error) => {
            console.error("Error loading comments: ", error);
        });
}

function updateLikesCountDisplay() {
    const likesCountElement = document.getElementById('likes-count');
    if (likesCountElement) {
        db.collection("posts").doc(currentPostId).get().then((doc) => {
            if (doc.exists) {
                const likesCount = doc.data().likesCount || 0;
                likesCountElement.innerHTML = `<i class="bx bxs-heart"></i> ${likesCount}`;
            }
        }).catch((error) => {
            console.error("Error getting likes count: ", error);
        });
    }
}
function createCommentElement(comment) {
    const template = document.getElementById('comment-template');
    const commentElement = template.content.cloneNode(true);


    commentElement.querySelector('.comment-author-image').src = comment.authorImage;
    commentElement.querySelector('.comment-author-name').textContent = comment.authorName;
    commentElement.querySelector('.comment-text').textContent = comment.text;
    commentElement.querySelector('.comment-date').textContent = formatDate(comment.createdAt);

    const likeButton = commentElement.querySelector('.like-button');
    const likeCount = commentElement.querySelector('.like-count');
    likeCount.textContent = comment.likes || 0;

    // Set up like functionality
    likeButton.addEventListener('click', () => handleLikeComment(comment.id, likeButton, likeCount));

    // Check if the comment is liked by the current user
    if (currentUser) {
        db.collection("posts").doc(currentPostId).collection("comments").doc(comment.id)
            .collection("likes").doc(currentUser.uid).get()
            .then((doc) => {
                if (doc.exists) {
                    likeButton.querySelector('i').classList.replace('bx-heart', 'bxs-heart');
                }
            });
    }

    // Set up remove functionality if the comment is by the current user
    const removeButton = commentElement.querySelector('.remove-comment-btn');
    if (currentUser && comment.authorId === currentUser.uid) {
        removeButton.style.display = 'inline-block';
        removeButton.addEventListener('click', () => removeComment(comment.id));
    }

    return commentElement;
}

function handleLikeComment(commentId, likeButton, likeCount) {
    console.log('handleLikeComment called', { commentId, currentUser, currentPostId });
    if (!currentUser) {
        alert('You must be logged in to like a comment.');
        return;
    }

    const likeRef = db.collection("posts").doc(currentPostId)
        .collection("comments").doc(commentId)
        .collection("likes").doc(currentUser.uid);

    likeRef.get().then((doc) => {
        console.log('Like document exists:', doc.exists);
        if (doc.exists) {
            // User has already liked, so unlike
            likeRef.delete().then(() => {
                console.log('Like deleted successfully');
                likeButton.querySelector('i').classList.replace('bxs-heart', 'bx-heart');
                updateLikeCount(commentId, likeCount, -1);
            }).catch(error => {
                console.error('Error deleting like:', error);
            });
        } else {
            // User hasn't liked, so add like
            likeRef.set({ timestamp: firebase.firestore.FieldValue.serverTimestamp() }).then(() => {
                console.log('Like added successfully');
                likeButton.querySelector('i').classList.replace('bx-heart', 'bxs-heart');
                updateLikeCount(commentId, likeCount, 1);
            }).catch(error => {
                console.error('Error adding like:', error);
            });
        }
    }).catch(error => {
        console.error('Error checking like status:', error);
    });
}
function updateLikeCount(commentId, likeCountElement, change) {
    const commentRef = db.collection("posts").doc(currentPostId).collection("comments").doc(commentId);

    return db.runTransaction((transaction) => {
        return transaction.get(commentRef).then((commentDoc) => {
            if (!commentDoc.exists) {
                throw "Document does not exist!";
            }
            const newLikes = (commentDoc.data().likes || 0) + change;
            transaction.update(commentRef, { likes: newLikes });
            return newLikes;
        });
    }).then((newLikes) => {
        likeCountElement.textContent = newLikes;
    }).catch((error) => {
        console.error("Error updating like count: ", error);
    });
}
function removeComment(commentId) {
    if (confirm('Are you sure you want to remove this comment?')) {
        db.collection("posts").doc(currentPostId).collection("comments").doc(commentId).delete()
            .then(() => {
                console.log("Comment successfully removed");
                loadComments(); // Reload comments to reflect the change
            })
            .catch((error) => {
                console.error("Error removing comment: ", error);
                alert('Failed to remove comment. Please try again.');
            });
    }
}
let currentStep = 0;
// Onboarding tour configuration
const steps = [
    { element: '.write-btn', text: 'Add posts using this button' },
    { element: '.admin-btn', text: 'Manage your account and posts' },
    { element: '#favoritesBtn', text: 'View and manage your favorite posts' }
];


function createBubble(text) {
    const bubble = document.createElement('div');
    bubble.className = 'instruction-bubble';
    bubble.innerHTML = `
        <div class="bubble-content">${text}</div>
        <div class="bubble-arrow"></div>
    `;
    document.body.appendChild(bubble);
    return bubble;
}

function positionBubble(bubble, element) {
    const elementRect = element.getBoundingClientRect();
    bubble.style.top = `${elementRect.bottom + 10}px`;
    bubble.style.left = `${elementRect.left + (elementRect.width / 2) - (bubble.offsetWidth / 2)}px`;
}

function showNextStep() {
    if (currentStep < steps.length) {
        const { element, text } = steps[currentStep];
        const targetElement = document.querySelector(element);
        if (targetElement) {
            const bubble = createBubble(text);
            positionBubble(bubble, targetElement);
            currentStep++;
        } else {
            currentStep++;
            showNextStep();
        }
    } else {
        // Tour completed
        localStorage.setItem('onboardingCompleted', 'true');
    }
}

function startOnboardingTour() {
    console.log("Starting onboarding tour..."); // Ensure this is printed
    if (localStorage.getItem('onboardingCompleted') !== 'true') {
        showNextStep();
        document.addEventListener('click', (e) => {
            const bubble = document.querySelector('.instruction-bubble');
            if (bubble && !e.target.closest('.instruction-bubble')) {
                bubble.remove();
                showNextStep();
            }
        });
    } else {
        console.log("Onboarding tour already completed.");
    }
}

const menuToggle = document.getElementById('menuToggle');
const navMenu = document.getElementById('navMenu');

menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    navMenu.classList.toggle('show-menu');
});

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    if (!navMenu.contains(e.target) && e.target !== menuToggle) {
        navMenu.classList.remove('show-menu');
    }
});

// Close menu when a nav item is clicked
const navItems = navMenu.querySelectorAll('button, a');
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navMenu.classList.remove('show-menu');
    });
});

// Change header background on scroll
function scrollHeader() {
    const header = document.querySelector('header');
    if (this.scrollY >= 50) header.classList.add('scroll-header');
    else header.classList.remove('scroll-header');
}
window.addEventListener('scroll', scrollHeader);
document.addEventListener("DOMContentLoaded", function () {
    function toggleHeaders() {
        const desktopHeader = document.querySelector('.desktop-header');
        const mobileHeader = document.querySelector('.mobile-header');

        if (!desktopHeader || !mobileHeader) {
            console.log("Header elements not found");
            return;
        }

        if (window.innerWidth >= 768) {
            desktopHeader.style.display = 'block';
            mobileHeader.style.display = 'none';
        } else {
            desktopHeader.style.display = 'none';
            mobileHeader.style.display = 'block';
        }
    }


    // Run the function when the page loads
    toggleHeaders();

    // Run the function every time the window is resized
    window.addEventListener('resize', toggleHeaders);
});
document.addEventListener('DOMContentLoaded', function () {
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');

    // Toggle the visibility of the nav-right menu on mobile
    menuToggle.addEventListener('click', () => {
        navMenu.classList.toggle('show');
    });
});


document.addEventListener('DOMContentLoaded', function () {
    setupEditPostForm();
    setupAuthObserver();
    setupSearchFunctionality();
    setupFilterListeners();
    setupShareFunctionality();
    setupFavorites();
    setupAccountListeners();
});
document.addEventListener('DOMContentLoaded', addBackToTopButton);
document.addEventListener('DOMContentLoaded', loadUserProfile);
document.addEventListener('DOMContentLoaded', startOnboardingTour);
