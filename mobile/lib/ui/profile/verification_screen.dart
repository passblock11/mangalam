import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:image_picker/image_picker.dart';

import '../../services/api_client.dart';
import '../../services/photo_service.dart';
import '../core/mangalam_theme.dart';

/// Lets the user submit a live selfie + government ID photo for manual
/// admin review. Once approved, they become "verified" and can view other
/// members' contact details (subject to Premium + the owner opting in).
class VerificationScreen extends StatefulWidget {
  const VerificationScreen({super.key});

  @override
  State<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends State<VerificationScreen> {
  final _api = ApiClient();

  String _status = 'none'; // none | pending | approved | rejected
  String? _note;
  String? _selfiePath; // storage path
  String? _govtIdPath; // storage path
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  Future<void> _loadStatus() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res =
          await _api.get('/v1/verification/status') as Map<String, dynamic>;
      if (!mounted) return;
      final v = (res['verification'] as Map<String, dynamic>?) ?? const {};
      setState(() {
        _status = (v['verification_status']?.toString() ?? 'none')
            .toLowerCase();
        _note = v['verification_note']?.toString();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickSelfie() async {
    final file = await PhotoService.pickFromCamera();
    if (file == null) return;
    setState(() => _submitting = true);
    try {
      final path = await PhotoService.uploadVerificationDoc(file, 'selfie');
      if (!mounted) return;
      setState(() => _selfiePath = path);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Selfie upload failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _pickGovtId() async {
    final file = await PhotoService.pickFromCamera();
    if (file == null) {
      // fallback to gallery
      final list = await PhotoService.pickFromGallery(remaining: 1);
      if (list.isEmpty) return;
      await _uploadGovtId(list.first);
      return;
    }
    await _uploadGovtId(file);
  }

  Future<void> _uploadGovtId(XFile file) async {
    setState(() => _submitting = true);
    try {
      final path = await PhotoService.uploadVerificationDoc(file, 'govt_id');
      if (!mounted) return;
      setState(() => _govtIdPath = path);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('ID upload failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _submit() async {
    if (_selfiePath == null || _govtIdPath == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add both a selfie and a government ID.')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await _api.post('/v1/verification/submit', {
        'selfie_url': _selfiePath,
        'govt_id_url': _govtIdPath,
      });
      if (!mounted) return;
      setState(() => _status = 'pending');
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Submitted for review.')));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profile verification')),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: MangalamTheme.maroon),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
              children: [
                _statusBanner(),
                const SizedBox(height: 20),
                if (_status != 'pending') ...[
                  _infoCard(),
                  const SizedBox(height: 18),
                  _uploadTile(
                    icon: Iconsax.camera,
                    title: 'Live selfie',
                    subtitle: _selfiePath != null
                        ? 'Captured'
                        : 'Take a front-facing photo',
                    done: _selfiePath != null,
                    onTap: _submitting ? null : _pickSelfie,
                  ),
                  const SizedBox(height: 12),
                  _uploadTile(
                    icon: Iconsax.document_upload,
                    title: 'Government ID',
                    subtitle: _govtIdPath != null
                        ? 'Uploaded'
                        : 'Aadhaar / PAN / Passport / Driving licence',
                    done: _govtIdPath != null,
                    onTap: _submitting ? null : _pickGovtId,
                  ),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: _submitting ? null : _submit,
                    icon: _submitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Iconsax.tick_square),
                    label: const Text('Submit for review'),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Your documents are private. Only our review team can see them, '
                    'and they are never shown to other members.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      color: MangalamTheme.muted,
                      height: 1.4,
                    ),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    _error!,
                    style: const TextStyle(
                      color: MangalamTheme.maroon,
                      fontSize: 12,
                    ),
                  ),
                ],
              ],
            ),
    );
  }

  Widget _statusBanner() {
    final Color tint;
    final String title;
    final String subtitle;
    final IconData icon;
    switch (_status) {
      case 'approved':
        tint = const Color(0xFF2E7D32);
        title = 'Verified';
        subtitle = 'You can now view contact details of members who opt in.';
        icon = Iconsax.verify;
      case 'pending':
        tint = MangalamTheme.gold;
        title = 'Under review';
        subtitle =
            'Our team is verifying your documents. This usually takes 24–48 hours.';
        icon = Iconsax.clock;
      case 'rejected':
        tint = MangalamTheme.maroon;
        title = 'Rejected';
        subtitle = _note?.isNotEmpty == true
            ? _note!
            : 'Please re-submit clear, valid documents.';
        icon = Iconsax.warning_2;
      default:
        tint = MangalamTheme.maroon;
        title = 'Not verified yet';
        subtitle =
            'Verify your identity to unlock contact details of other members.';
        icon = Iconsax.shield;
    }
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: tint.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: tint.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: tint.withValues(alpha: 0.18),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: tint, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    color: tint,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: MangalamTheme.muted,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoCard() {
    return MangalamCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Iconsax.shield, color: MangalamTheme.maroon, size: 20),
              const SizedBox(width: 8),
              const Text(
                'Why verify?',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _bullet('Builds trust — members feel safe sharing contact with you.'),
          _bullet(
            'Only verified + Premium members can view others\' phone / WhatsApp.',
          ),
          _bullet('Manual review by our team keeps the community genuine.'),
        ],
      ),
    );
  }

  Widget _bullet(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Iconsax.tick_circle, size: 16, color: MangalamTheme.gold),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                fontSize: 13,
                color: MangalamTheme.ink,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _uploadTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool done,
    required VoidCallback? onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: done
              ? MangalamTheme.gold.withValues(alpha: 0.08)
              : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: done
                ? MangalamTheme.gold.withValues(alpha: 0.4)
                : const Color(0xFFE7E2DC),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: MangalamTheme.maroon.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: MangalamTheme.maroon, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: MangalamTheme.muted,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              done ? Iconsax.tick_circle : Iconsax.arrow_right,
              color: done ? MangalamTheme.gold : MangalamTheme.muted,
              size: 22,
            ),
          ],
        ),
      ),
    );
  }
}
