# Angular File Service Design Document

This document outlines the design for an Angular fileService that will provide easy CRUD access to both the local filesystem as well as collections of files stored in the indexedDB. The service will also support archive management, enabling users to create, delete, list and move files between archives.

## Overview

The `FileService` is designed to be a modular and reusable service that can handle all file-related operations within an Angular application. It allows developers to easily integrate file system access, database management for collections of files, and archive creation and manipulation into their projects.

## Features

* **Filesystem Access:** The `FileService` provides methods for reading, writing, creating, and deleting individual files on the local filesystem in a secure and user-friendly manner using the File System Access API.
* **IndexedDB Access:** The `FileService` supports creating, listing, updating, and deleting collections of files stored in indexedDB. Collections will be referred to as 'archives'.
* **Archive Management:** Developers can easily create new archives, delete existing ones, list all available archives, and move files from one archive to another.

## Design Considerations

The `FileService` should follow these design principles:

* **Modularity**: The service should be modular and easily integratable into any Angular application without causing conflicts or overriding existing functionality.
* **Abstraction**: The service should provide a high-level API for file management, hiding the complexities of lower level APIs such as IndexedDB or File System Access.
* **Flexibility**: The `FileService` should be flexible enough to support a wide range of use cases and file formats, while still remaining performant and secure.
* **Reliability**: The service should ensure data consistency and reliability during all CRUD operations by using appropriate error handling techniques and validations.

## Implementation

The following is the outline for implementing the `FileService`:

### FileSystem Access

* **Read Files:** Implement a method that allows reading of files from the local filesystem. Use `window.showOpenFilePicker()`, `fileHandle.getFile()`, and read methods such as `text()` or `arrayBuffer()`.
* **Write/Create Files:** Implement a method that allows writing or creating files on the local filesystem. Use `window.showSaveFilePicker()` and write methods such as `createWritable()`, `write()`, and `close()`.
* **Delete Files:** Implement a method for deleting files from the local filesystem. First, get access to it using the read/create operations mentioned above, then call `fileSystemHandle.remove({recursive: true})`.

### IndexedDB Access

* **Create Archive:** Implement a method that creates an empty archive in indexedDB and returns its ID or keyPath for future references.
* **List Archives:** Implement a method to retrieve all existing archives from indexedDB as a list of keys or objects.
* **Update/Delete Archive:** Implement methods that allow updating the metadata (such as name) and deleting an archive by its ID or keyPath.
* **Add/Remove File from Archive:** Implement methods for adding and removing files to/from an existing archive in indexedDB, using appropriate file identifiers (such as path, hash, or URL).

### Error Handling and Validations

The `FileService` should include appropriate error handling and validations for all CRUD operations. Errors should be propagated through the application layer, where they can be caught and handled appropriately by the consumer of the service. Input validation is also important to ensure that invalid or malicious input does not cause unexpected behavior in the service.
