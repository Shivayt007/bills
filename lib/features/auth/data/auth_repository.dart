import 'package:firebase_auth/firebase_auth.dart';

class AuthRepository {
  AuthRepository(this._auth);
  final FirebaseAuth _auth;
  Stream<User?> watchUser() => _auth.authStateChanges();
  User? get currentUser => _auth.currentUser;
  Future<void> signIn(String email, String password) async {
    await _auth.signInWithEmailAndPassword(email: email.trim(), password: password);
  }
  Future<void> signOut() => _auth.signOut();
  Future<void> verifyPassword(String password) async {
    final user = _auth.currentUser;
    final email = user?.email;
    if (user == null || email == null || email.isEmpty) {
      throw StateError('An email and password account is required.');
    }
    await user.reauthenticateWithCredential(
      EmailAuthProvider.credential(email: email, password: password));
  }
  Future<bool> isAdmin() async {
    final user = _auth.currentUser;
    if (user == null) return false;
    final token = await user.getIdTokenResult(true);
    return token.claims?['admin'] == true;
  }
}
