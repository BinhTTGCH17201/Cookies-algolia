const algoliasearch = require('algoliasearch');
const functions = require('firebase-functions');
const admin = require("firebase-admin");

var serviceAccount = require("./cooking-forum-firebase-adminsdk-9qcbv-609acad68a.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://cooking-forum-default-rtdb.firebaseio.com"
});

const algolia = algoliasearch(functions.config().algolia.app,
    functions.config().algolia.key);
const index = algolia.initIndex(functions.config().algolia.index);

exports.syncAlgoliaWithFirebaseDatabase = functions.database.ref('/posts/{postId}').onWrite(
    (snapshot, context) => {
        // When post created
        if (!snapshot.before.exists()) {
            const post = snapshot.after.val();
            post.objectID = context.params.postId;

            console.log('Creating post ', post.objectID);
            return index.saveObject(post)
                .then(() => {
                    console.log('Firebase object created from Algolia')
                })
                .catch(error => {
                    console.error('Error when creating contact from Algolia', error);
                    process.exit(1);
                });
        }

        // When post deleted
        if (!snapshot.after.exists()) {
            const objectID = context.params.postId;
            console.log('Deleting post ', objectID);
            // Remove the object from Algolia
            index
                .deleteObject(objectID)
                .then(() => {
                    console.log('Firebase object deleted from Algolia', objectID);
                })
                .catch(error => {
                    console.error('Error when deleting contact from Algolia', error);
                    process.exit(1);
                });
        }

        if (snapshot.after.exists() && snapshot.before.exists()) {
            const post = snapshot.after.val();
            post.objectID = context.params.postId;

            console.log('Updating post ', post.objectID);
            return index.saveObject(post)
                .then(() => {
                    console.log('Firebase object updated from Algolia')
                })
                .catch(error => {
                    console.error('Error when updating contact from Algolia', error);
                    process.exit(1);
                });
        }
    }
)

exports.writeToDb = functions.auth.user().onCreate((user) => {
    const newUser = {
        admin: false,
        name: "",
        photo: ""
    }

    admin.database().ref(`/users/${user.uid}`).set(newUser).then(() => {
        console.log(`Success save new user to database!`);
    }).catch((error) => {
        console.log(`Fail to save new user to database! Error: ${error}`);
    })
});

exports.updateUserDb = functions.database.ref(`/users/{userId}`).onCreate((snapshot, context) => {
    admin
        .auth()
        .getUser(context.params.userId)
        .then((userRecord) => {
            // See the UserRecord reference doc for the contents of userRecord.
            let name = "";
            if (userRecord.displayName != null) name = userRecord.displayName;
            let photo = "https://firebasestorage.googleapis.com/v0/b/cooking-forum.appspot.com/o/userProfileImage%2Fuser_profile_placeholder.png?alt=media&token=4e9824f7-99cd-4907-8c20-b339b8bd07e7";
            if (userRecord.photoURL != "") photo = userRecord.photoURL;

            const newUser = {
                name: name,
                photo: photo,
                admin: false
            }

            admin
                .auth()
                .updateUser(context.params.userId, {
                    emailVerified: true,
                    displayName: name,
                    photoURL: photo,
                })
                .then((userRecord) => {
                    admin.database().ref(`/users/${context.params.userId}`).set(newUser).then(() => {
                        console.log(`User ${context.params.userId} save!`);
                        return true;
                    }).catch((error) => {
                        console.log(`User ${context.params.userId} not save!`);
                        return false;
                    })
                })
                .catch((error) => {
                    console.log('Error updating user:', error);
                });


        })
        .catch((error) => {
            console.log('Error fetching user data:', error);
            return false
        });
})

exports.deleteuser = functions.auth.user().onDelete((user) => {
    admin.database().ref(`/users/${user.uid}`).remove().then(() => {
        console.log(`Success delete user to database!`);
        return true;
    }).catch((error) => {
        console.log(`Fail to delete user to database! Error: ${error}`);
        return false;
    })
});