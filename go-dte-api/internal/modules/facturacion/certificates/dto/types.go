package dto

type UploadRequest struct {
	NIT         string `json:"nit"`
	EmisorID    int    `json:"emisorId"`
	PasswordPri string `json:"passwordPri"`
}

type UploadResponse struct {
	Success bool   `json:"success"`
	NIT     string `json:"nit"`
	Activo  bool   `json:"activo"`
	Path    string `json:"path"`
}

type WarmupRequest struct {
	FirebaseUID string `json:"firebaseUid"`
	EmisorID    int    `json:"emisorId"`
	NIT         string `json:"nit"`
}

type WarmupResponse struct {
	Success bool   `json:"success"`
	NIT     string `json:"nit"`
	Cached  bool   `json:"cached"`
}
