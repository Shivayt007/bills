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
  Future<bool> isAdmin() async {
    final user = _auth.currentUser;
    if (user == null) return false;
    final token = await user.getIdTokenResult(true);
    return token.claims?['admin'] == true;
  }
}
